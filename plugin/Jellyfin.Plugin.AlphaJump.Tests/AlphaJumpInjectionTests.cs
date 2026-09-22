using System.Text;
using Jellyfin.Plugin.AlphaJump.Configuration;
using Jellyfin.Plugin.AlphaJump.Web;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Jellyfin.Plugin.AlphaJump.Tests;

public class AlphaJumpInjectionTests
{
    [Theory]
    [InlineData("/web/index.html", "/AlphaJump/client-config")]
    [InlineData("/jellyfin/web/index.html", "/jellyfin/AlphaJump/client-config")]
    public async Task MiddlewareInjectsRootAndBaseUrlHostedIndex(string requestPath, string configUrl)
    {
        var response = await Invoke(requestPath, "text/html; charset=utf-8", Html());

        Assert.Equal(StatusCodes.Status200OK, response.Context.Response.StatusCode);
        Assert.Contains(configUrl, response.Body, StringComparison.Ordinal);
        Assert.Equal(1, response.Body.Split("alpha-jump-plugin-bootstrap", StringSplitOptions.None).Length - 1);
    }

    [Fact]
    public async Task MiddlewareDoesNotDuplicateExistingMarker()
    {
        var body = Html().Replace("</head>", "<script id=\"alpha-jump-plugin-bootstrap\"></script></head>", StringComparison.Ordinal);
        var response = await Invoke("/jellyfin/web/index.html", "text/html", body);

        Assert.Equal(body, response.Body);
        Assert.Equal(1, response.Body.Split("alpha-jump-plugin-bootstrap", StringSplitOptions.None).Length - 1);
    }

    [Theory]
    [InlineData("/jellyfin/Items", "application/json")]
    [InlineData("/jellyfin/Videos/abc/stream", "video/mp4")]
    public async Task MiddlewarePassesApiAndMediaPathsThroughUntouched(string requestPath, string contentType)
    {
        const string body = "unmodified response";
        var response = await Invoke(requestPath, contentType, body);

        Assert.Equal(body, response.Body);
        Assert.DoesNotContain("alpha-jump-plugin-bootstrap", response.Body, StringComparison.Ordinal);
    }

    private static async Task<(DefaultHttpContext Context, string Body)> Invoke(string requestPath, string contentType, string body)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Get;
        context.Request.Path = requestPath;
        context.Response.Body = new MemoryStream();
        var middleware = new AlphaJumpInjectionMiddleware(async httpContext =>
        {
            httpContext.Response.StatusCode = StatusCodes.Status200OK;
            httpContext.Response.ContentType = contentType;
            await httpContext.Response.WriteAsync(body);
        }, new EnabledConfigurationService());

        await middleware.Invoke(context);
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body, Encoding.UTF8, leaveOpen: true);
        return (context, await reader.ReadToEndAsync());
    }

    private static string Html() => "<!doctype html><html><head><title>Jellyfin</title></head><body></body></html>";

    private sealed class EnabledConfigurationService : IAlphaJumpConfigurationService
    {
        public bool IsGloballyEnabled => true;
        public ClientLibraryConfiguration GetClientConfiguration(Guid libraryId) => throw new NotSupportedException();
        public AdministratorConfiguration GetAdministratorConfiguration() => throw new NotSupportedException();
        public AdministratorConfiguration SaveAdministratorConfiguration(AdministratorConfigurationUpdate update) => throw new NotSupportedException();
    }
}
