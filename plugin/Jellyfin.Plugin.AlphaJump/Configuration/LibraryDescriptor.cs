namespace Jellyfin.Plugin.AlphaJump.Configuration;

/// <summary>One currently discovered Jellyfin collection folder.</summary>
public sealed record LibraryDescriptor(Guid Id, string Name, string CollectionType)
{
    /// <summary>Gets whether the folder is a supported Movies or Shows library.</summary>
    public bool IsSupported => string.Equals(CollectionType, "movies", StringComparison.OrdinalIgnoreCase)
        || string.Equals(CollectionType, "tvshows", StringComparison.OrdinalIgnoreCase);

    /// <summary>Gets a short administrator-facing explanation for unsupported folders.</summary>
    public string? UnsupportedReason => IsSupported
        ? null
        : "Alpha Jump currently supports Movies and Shows libraries only.";
}
