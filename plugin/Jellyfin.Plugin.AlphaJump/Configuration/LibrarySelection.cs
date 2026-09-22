namespace Jellyfin.Plugin.AlphaJump.Configuration;

/// <summary>
/// Resolves persisted library selections. Discovery creates a record exactly
/// once, so later changes to the automatic-new setting never rewrite a choice.
/// </summary>
public static class LibrarySelection
{
    /// <summary>
    /// Gets whether the given stable library ID is enabled by this configuration.
    /// </summary>
    public static bool IsEnabled(PluginConfiguration configuration, Guid libraryId)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        return configuration.Enabled && IsSelectionEnabled(configuration, libraryId);
    }

    /// <summary>
    /// Gets the persisted per-library choice without applying the global switch.
    /// The administrator page uses this so temporarily disabling Alpha Jump does
    /// not visually erase choices and overwrite them on a later save.
    /// </summary>
    public static bool IsSelectionEnabled(PluginConfiguration configuration, Guid libraryId)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var normalized = LibraryId.Normalize(libraryId);
        var selection = configuration.LibrarySelections?.FirstOrDefault(
            item => LibraryId.TryNormalize(item.LibraryId, out var itemId)
                && string.Equals(itemId, normalized, StringComparison.Ordinal));
        return selection?.Enabled == true;
    }

    /// <summary>Gets whether a supported library has a persisted discovery record.</summary>
    public static bool HasSelection(PluginConfiguration configuration, Guid libraryId)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var normalized = LibraryId.Normalize(libraryId);
        return configuration.LibrarySelections?.Any(
            item => LibraryId.TryNormalize(item.LibraryId, out var itemId)
                && string.Equals(itemId, normalized, StringComparison.Ordinal)) == true;
    }
}
