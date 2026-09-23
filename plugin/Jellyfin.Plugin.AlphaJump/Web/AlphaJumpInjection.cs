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
    public static bool TryInject(string html, PathString pathBase, IAlphaJumpRuntimeInfo runtimeInfo, out string transformed)
    {
        ArgumentNullException.ThrowIfNull(html);
        ArgumentNullException.ThrowIfNull(runtimeInfo);
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

        transformed = html.Insert(closingHead, BuildBootstrapMarkup(pathBase, runtimeInfo));
        return true;
    }

    /// <summary>
    /// Builds markup with a base-path-aware script and config URL.
    /// </summary>
    public static string BuildBootstrapMarkup(PathString pathBase, IAlphaJumpRuntimeInfo runtimeInfo)
    {
        var prefix = pathBase.HasValue ? pathBase.Value!.TrimEnd('/') : string.Empty;
        var encodedPrefix = HtmlEncoder.Default.Encode(prefix);
        var fingerprint = WebUtility.UrlEncode(runtimeInfo.ScriptFingerprint);
        var runtimeId = HtmlEncoder.Default.Encode(runtimeInfo.RuntimeId);
        var version = HtmlEncoder.Default.Encode(runtimeInfo.PluginVersion);
        return $"<script id=\"{MarkerId}\" data-alpha-jump-mode=\"plugin\" data-alpha-jump-config-url=\"{encodedPrefix}/AlphaJump/client-config\" data-alpha-jump-runtime-url=\"{encodedPrefix}/AlphaJump/runtime\" data-alpha-jump-runtime-id=\"{runtimeId}\" data-alpha-jump-script-fingerprint=\"{fingerprint}\" data-alpha-jump-plugin-version=\"{version}\"></script>"
            + $"<script src=\"{encodedPrefix}/AlphaJump/alpha-jump.js?h={fingerprint}\" defer></script>";
    }
}
