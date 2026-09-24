namespace Jellyfin.Plugin.AlphaJump.Configuration;

/// <summary>Serialized access to discovered libraries and plugin configuration.</summary>
public interface IAlphaJumpConfigurationService
{
    /// <summary>Gets whether injection is enabled globally.</summary>
    bool IsGloballyEnabled { get; }

    /// <summary>Gets a discovered library's effective configuration, failing closed when unknown.</summary>
    ClientLibraryConfiguration GetClientConfiguration(Guid libraryId);

    /// <summary>Gets the explicit configuration for Jellyfin's built-in Collections view.</summary>
    ClientLibraryConfiguration GetBuiltInCollectionsConfiguration();

    /// <summary>Gets the current configuration and every current library for the administrator page.</summary>
    AdministratorConfiguration GetAdministratorConfiguration();

    /// <summary>Saves administrator changes without replacing selections discovered concurrently.</summary>
    AdministratorConfiguration SaveAdministratorConfiguration(AdministratorConfigurationUpdate update);
}

/// <summary>Minimal configuration supplied to one authenticated browser route.</summary>
public sealed record ClientLibraryConfiguration(
    bool Enabled,
    bool LibraryEnabled,
    bool AutoDisablePagination,
    bool SmoothScroll,
    bool Debug,
    string KeyboardJumpMode);

/// <summary>Administrator-facing plugin configuration and current server folders.</summary>
public sealed record AdministratorConfiguration(
    bool Enabled,
    bool AutoEnableNewSupportedLibraries,
    bool BuiltInCollectionsEnabled,
    bool AutoDisablePagination,
    bool SmoothScroll,
    bool Debug,
    string KeyboardJumpMode,
    IReadOnlyList<AdministratorLibrary> Libraries);

/// <summary>One library rendered by the administrator page.</summary>
public sealed record AdministratorLibrary(
    string LibraryId,
    string Name,
    string CollectionType,
    bool Supported,
    bool Enabled,
    string? Explanation);

/// <summary>Administrator update payload. Omitted selections retain their current state.</summary>
public sealed record AdministratorConfigurationUpdate(
    bool Enabled,
    bool AutoEnableNewSupportedLibraries,
    bool BuiltInCollectionsEnabled,
    bool AutoDisablePagination,
    bool SmoothScroll,
    bool Debug,
    string KeyboardJumpMode,
    IReadOnlyList<AdministratorLibrarySelectionUpdate>? LibrarySelections);

/// <summary>One explicit administrator library choice.</summary>
public sealed record AdministratorLibrarySelectionUpdate(string LibraryId, bool Enabled);
