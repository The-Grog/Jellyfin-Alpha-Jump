using System.Net;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Http;

namespace Jellyfin.Plugin.AlphaJump.Web;

/// <summary>
/// Builds and inserts the fixed plugin bootstrap markup. Keeping this operation
/// pure makes duplicate-injection and base-path behavior testable without a
/// running Jellyfin server.
/// </summary>
public static class AlphaJumpInjection
{
    private const string MarkerId = "alpha-jump-plugin-bootstrap";

    /// <summary>
    /// Tries to append the bootstrap marker and embedded-script URL to HTML.
    /// </summary>
    public static bool TryInject(string html, PathString pathBase, out string transformed)
    {
        ArgumentNullException.ThrowIfNull(html);
        transformed = html;

        if (html.Contains($"id=\"{MarkerId}\"", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var closingHead = html.LastIndexOf("</head>", StringComparison.OrdinalIgnoreCase);
        if (closingHead < 0)
        {
            return false;
        }

        transformed = html.Insert(closingHead, BuildBootstrapMarkup(pathBase));
        return true;
    }

    /// <summary>
    /// Builds markup with a base-path-aware script and config URL.
    /// </summary>
    public static string BuildBootstrapMarkup(PathString pathBase)
    {
        var prefix = pathBase.HasValue ? pathBase.Value!.TrimEnd('/') : string.Empty;
        var encodedPrefix = HtmlEncoder.Default.Encode(prefix);
        var version = WebUtility.UrlEncode(typeof(Plugin).Assembly.GetName().Version?.ToString() ?? "0");
        return $"<script id=\"{MarkerId}\" data-alpha-jump-mode=\"plugin\" data-alpha-jump-config-url=\"{encodedPrefix}/AlphaJump/client-config\"></script>"
            + $"<script src=\"{encodedPrefix}/AlphaJump/alpha-jump.js?v={version}\" defer></script>";
    }
}
