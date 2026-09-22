using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.AlphaJump.Configuration;

/// <summary>
/// Discovers collection folders from Jellyfin's supported library manager and
/// serializes discovery plus administrator writes so discovery never overwrites
/// an explicit selection.
/// </summary>
public sealed class AlphaJumpConfigurationService : IAlphaJumpConfigurationService
{
    private readonly ILibraryManager _libraryManager;
    private readonly object _sync = new();

    /// <summary>Initializes a new instance of the configuration service.</summary>
    public AlphaJumpConfigurationService(ILibraryManager libraryManager)
    {
        _libraryManager = libraryManager;
    }

    /// <inheritdoc />
    public bool IsGloballyEnabled => Plugin.Instance?.Configuration.Enabled == true;

    /// <inheritdoc />
    public ClientLibraryConfiguration GetClientConfiguration(Guid libraryId)
    {
        lock (_sync)
        {
            var configuration = RequireConfiguration();
            var libraries = DiscoverAndSynchronize(configuration);
            var supported = libraries.Any(library => library.Id == libraryId && library.IsSupported);
            return new ClientLibraryConfiguration(
                configuration.Enabled,
                supported && LibrarySelection.IsEnabled(configuration, libraryId),
                configuration.AutoDisablePagination,
                configuration.SmoothScroll,
                configuration.Debug);
        }
    }

    /// <inheritdoc />
    public AdministratorConfiguration GetAdministratorConfiguration()
    {
        lock (_sync)
        {
            var configuration = RequireConfiguration();
            return ToAdministratorConfiguration(configuration, DiscoverAndSynchronize(configuration));
        }
    }

    /// <inheritdoc />
    public AdministratorConfiguration SaveAdministratorConfiguration(AdministratorConfigurationUpdate update)
    {
        ArgumentNullException.ThrowIfNull(update);
        lock (_sync)
        {
            var configuration = RequireConfiguration();
            var libraries = DiscoverAndSynchronize(configuration);
            configuration.Enabled = update.Enabled;
            configuration.AutoEnableNewSupportedLibraries = update.AutoEnableNewSupportedLibraries;
            configuration.AutoDisablePagination = update.AutoDisablePagination;
            configuration.SmoothScroll = update.SmoothScroll;
            configuration.Debug = update.Debug;

            var supported = libraries.Where(library => library.IsSupported)
                .ToDictionary(library => LibraryId.Normalize(library.Id), StringComparer.Ordinal);
            foreach (var updateSelection in update.LibrarySelections ?? [])
            {
                if (!LibraryId.TryNormalize(updateSelection.LibraryId, out var id) || !supported.ContainsKey(id))
                {
                    continue;
                }

                var selection = configuration.LibrarySelections.FirstOrDefault(
                    item => LibraryId.TryNormalize(item.LibraryId, out var selectionId)
                        && string.Equals(selectionId, id, StringComparison.Ordinal));
                if (selection is not null)
                {
                    selection.Enabled = updateSelection.Enabled;
                }
            }

            Plugin.Instance!.UpdateConfiguration(configuration);
            return ToAdministratorConfiguration(configuration, libraries);
        }
    }

    private PluginConfiguration RequireConfiguration()
    {
        return Plugin.Instance?.Configuration
            ?? throw new InvalidOperationException("Alpha Jump plugin configuration is not available.");
    }

    private IReadOnlyList<LibraryDescriptor> DiscoverAndSynchronize(PluginConfiguration configuration)
    {
        var libraries = _libraryManager.RootFolder.VirtualChildren
            .OfType<CollectionFolder>()
            .Select(folder => new LibraryDescriptor(folder.Id, folder.Name, folder.CollectionType?.ToString() ?? string.Empty))
            .OrderBy(folder => folder.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (LibraryDiscoverySynchronizer.Synchronize(configuration, libraries))
        {
            Plugin.Instance!.UpdateConfiguration(configuration);
        }

        return libraries;
    }

    private static AdministratorConfiguration ToAdministratorConfiguration(
        PluginConfiguration configuration,
        IReadOnlyList<LibraryDescriptor> libraries)
    {
        return new AdministratorConfiguration(
            configuration.Enabled,
            configuration.AutoEnableNewSupportedLibraries,
            configuration.AutoDisablePagination,
            configuration.SmoothScroll,
            configuration.Debug,
            libraries.Select(library => new AdministratorLibrary(
                LibraryId.Normalize(library.Id),
                library.Name,
                library.CollectionType,
                library.IsSupported,
                library.IsSupported && LibrarySelection.IsEnabled(configuration, library.Id),
                library.UnsupportedReason)).ToArray());
    }
}
