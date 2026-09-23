using System.Globalization;
using Jellyfin.Plugin.AlphaJump.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Jellyfin.Plugin.AlphaJump.Web;

namespace Jellyfin.Plugin.AlphaJump;

/// <summary>
/// Jellyfin entry point for the Alpha Jump Web enhancement.
/// </summary>
public sealed class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>
    /// The stable plugin identifier.
    /// </summary>
    public static readonly Guid PluginId = Guid.Parse("4dd1ed79-9e5e-441e-8ca3-8f1b29601a48");

    /// <summary>
    /// Gets the active plugin instance.
    /// </summary>
    public static Plugin? Instance { get; private set; }

    /// <summary>Gets this process's browser-payload identity.</summary>
    public IAlphaJumpRuntimeInfo RuntimeInfo { get; }

    /// <summary>
    /// Initializes a new instance of the <see cref="Plugin"/> class.
    /// </summary>
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
        using var script = GetType().Assembly.GetManifestResourceStream("Jellyfin.Plugin.AlphaJump.Resources.alpha-jump.js")
            ?? throw new InvalidOperationException("The embedded Alpha Jump browser script is missing.");
        RuntimeInfo = AlphaJumpRuntimeInfo.Create(script, GetType().Assembly.GetName().Version);
    }

    /// <inheritdoc />
    public override string Name => "Alpha Jump";

    /// <inheritdoc />
    public override Guid Id => PluginId;

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        return
        [
            new PluginPageInfo
            {
                Name = Name,
                EmbeddedResourcePath = string.Format(
                    CultureInfo.InvariantCulture,
                    "{0}.Configuration.configPage.html",
                    GetType().Namespace)
            }
        ];
    }
}
