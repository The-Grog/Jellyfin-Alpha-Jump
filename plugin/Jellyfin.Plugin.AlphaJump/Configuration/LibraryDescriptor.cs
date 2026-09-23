namespace Jellyfin.Plugin.AlphaJump.Configuration;

/// <summary>One currently discovered Jellyfin collection folder.</summary>
public sealed record LibraryDescriptor(Guid Id, string Name, string CollectionType)
{
    private static readonly HashSet<string> SupportedCollectionTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "books", "boxsets", "homevideos", "mixed", "movies", "music", "musicvideos", "playlists", "tvshows"
    };

    /// <summary>Gets the source-backed effective type for this folder.</summary>
    public string EffectiveCollectionType => string.IsNullOrWhiteSpace(CollectionType)
        || string.Equals(CollectionType, "unknown", StringComparison.OrdinalIgnoreCase)
        ? "mixed"
        : CollectionType.Trim().ToLowerInvariant();

    /// <summary>Gets whether the folder has a compatible Alpha Jump grid.</summary>
    public bool IsSupported => SupportedCollectionTypes.Contains(EffectiveCollectionType);

    /// <summary>Gets a short administrator-facing explanation for unsupported folders.</summary>
    public string? UnsupportedReason => IsSupported
        ? null
        : string.Equals(EffectiveCollectionType, "livetv", StringComparison.OrdinalIgnoreCase)
            ? "Live TV is intentionally unsupported; Alpha Jump leaves its guides, channels, and recordings native."
            : "This library type does not have a source-backed Alpha Jump grid.";
}
