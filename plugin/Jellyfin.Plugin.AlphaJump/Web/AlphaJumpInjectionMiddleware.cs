using System.Text;
using Jellyfin.Plugin.AlphaJump.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace Jellyfin.Plugin.AlphaJump.Web;

/// <summary>
/// Rewrites only Jellyfin Web's index document in memory. It passes every API,
/// media, image, script, and non-index Web request through unchanged.
/// </summary>
public sealed class AlphaJumpInjectionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IAlphaJumpConfigurationService _configurationService;

    /// <summary>
    /// Initializes a new instance of the <see cref="AlphaJumpInjectionMiddleware"/> class.
    /// </summary>
    public AlphaJumpInjectionMiddleware(RequestDelegate next, IAlphaJumpConfigurationService configurationService)
    {
        _next = next;
        _configurationService = configurationService;
    }

    /// <summary>
    /// Invokes the middleware.
    /// </summary>
    public async Task Invoke(HttpContext context)
    {
        if (!TryGetWebBasePath(context.Request, out var injectionBasePath) || !_configurationService.IsGloballyEnabled)
        {
            await _next(context).ConfigureAwait(false);
            return;
        }

        var originalFeature = context.Features.Get<IHttpResponseBodyFeature>();
        if (originalFeature is null)
        {
            await _next(context).ConfigureAwait(false);
            return;
        }

        var originalAcceptEncoding = context.Request.Headers.AcceptEncoding;
        var originalIfNoneMatch = context.Request.Headers.IfNoneMatch;
        var originalIfModifiedSince = context.Request.Headers.IfModifiedSince;
        context.Request.Headers.Remove("Accept-Encoding");
        context.Request.Headers.Remove("If-None-Match");
        context.Request.Headers.Remove("If-Modified-Since");

        await using var buffer = new MemoryStream();
        context.Features.Set<IHttpResponseBodyFeature>(new StreamResponseBodyFeature(buffer));
        try
        {
            await _next(context).ConfigureAwait(false);
            context.Features.Set(originalFeature);

            buffer.Position = 0;
            if (!ShouldRewriteResponse(context.Response))
            {
                await buffer.CopyToAsync(context.Response.Body, context.RequestAborted).ConfigureAwait(false);
                return;
            }

            using var reader = new StreamReader(buffer, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
            var html = await reader.ReadToEndAsync(context.RequestAborted).ConfigureAwait(false);
            if (!AlphaJumpInjection.TryInject(html, injectionBasePath, out var transformed))
            {
                buffer.Position = 0;
                await buffer.CopyToAsync(context.Response.Body, context.RequestAborted).ConfigureAwait(false);
                return;
            }

            var bytes = Encoding.UTF8.GetBytes(transformed);
            context.Response.Headers.Remove("ETag");
            context.Response.Headers.Remove("Last-Modified");
            context.Response.Headers.Remove("Content-Encoding");
            context.Response.Headers.Remove("Content-Range");
            context.Response.ContentLength = bytes.Length;
            await context.Response.Body.WriteAsync(bytes, context.RequestAborted).ConfigureAwait(false);
        }
        finally
        {
            context.Features.Set(originalFeature);
            context.Request.Headers.AcceptEncoding = originalAcceptEncoding;
            context.Request.Headers.IfNoneMatch = originalIfNoneMatch;
            context.Request.Headers.IfModifiedSince = originalIfModifiedSince;
        }
    }

    /// <summary>
    /// Finds Jellyfin Web's index endpoint before Jellyfin maps its configured
    /// base URL. The startup filter is outer middleware, so with Base URL
    /// <c>/jellyfin</c> the raw request path is
    /// <c>/jellyfin/web/index.html</c>, not <c>/web/index.html</c>.
    /// </summary>
    internal static bool TryGetWebBasePath(HttpRequest request, out PathString basePath)
    {
        basePath = PathString.Empty;
        if (!HttpMethods.IsGet(request.Method))
        {
            return false;
        }

        var path = request.Path.Value ?? string.Empty;
        foreach (var suffix in new[] { "/web/index.html", "/web/", "/web" })
        {
            if (path.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            {
                var prefix = path[..^suffix.Length];
                // The prefix is either Jellyfin's configured Base URL or empty.
                // A complete path segment is required so /notweb cannot match.
                if (prefix.Length == 0 || prefix.StartsWith("/", StringComparison.Ordinal))
                {
                    basePath = prefix.Length == 0 ? request.PathBase : new PathString(prefix);
                    return true;
                }
            }
        }

        return false;
    }

    private static bool ShouldRewriteResponse(HttpResponse response)
    {
        return response.StatusCode == StatusCodes.Status200OK
            && response.ContentType?.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) == true;
    }
}
