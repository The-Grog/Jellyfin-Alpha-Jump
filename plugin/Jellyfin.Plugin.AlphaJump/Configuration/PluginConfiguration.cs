using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.AlphaJump.Configuration;

/// <summary>
/// Persisted server configuration. Library choices are keyed exclusively by the
/// Jellyfin collection-folder GUID; names are intentionally never persisted.
/// </summary>
public sealed class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Gets or sets a value indicating whether all Alpha Jump injection is enabled.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether a newly discovered supported
    /// library is enabled when it has no explicit selection yet.
    /// </summary>
    public bool AutoEnableNewSupportedLibraries { get; set; } = true;

    /// <summary>
    /// Gets or sets persisted selections for discovered supported libraries.
    /// A list of simple records is deliberately used because Jellyfin persists
    /// plugin configuration as XML and XML serializers do not support a
    /// <see cref="Dictionary{TKey,TValue}" /> with GUID keys.
    /// </summary>
    public List<LibrarySelectionRecord> LibrarySelections { get; set; } = [];

    /// <summary>
    /// Gets or sets a value indicating whether the browser code sets the active
    /// user's local library page size to zero once.
    /// </summary>
    public bool AutoDisablePagination { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether browser scrolling is smooth when
    /// the user has not requested reduced motion.
    /// </summary>
    public bool SmoothScroll { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether browser debug messages are enabled.
    /// </summary>
    public bool Debug { get; set; }
}
