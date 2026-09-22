namespace Jellyfin.Plugin.AlphaJump.Configuration;

/// <summary>
/// Adds one XML-persisted selection record for each newly discovered supported
/// library. It never changes an existing record and never removes stale IDs.
/// </summary>
public static class LibraryDiscoverySynchronizer
{
    /// <summary>Synchronizes discovery state and returns whether configuration changed.</summary>
    public static bool Synchronize(PluginConfiguration configuration, IEnumerable<LibraryDescriptor> libraries)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(libraries);

        configuration.LibrarySelections ??= [];
        var known = new HashSet<string>(
            configuration.LibrarySelections
                .Select(selection => LibraryId.TryNormalize(selection.LibraryId, out var normalized) ? normalized : null)
                .Where(normalized => normalized is not null)!
                .Cast<string>(),
            StringComparer.Ordinal);
        var changed = false;

        foreach (var library in libraries.Where(library => library.IsSupported)
                     .GroupBy(library => LibraryId.Normalize(library.Id), StringComparer.Ordinal)
                     .Select(group => group.First()))
        {
            var id = LibraryId.Normalize(library.Id);
            if (known.Add(id))
            {
                configuration.LibrarySelections.Add(new LibrarySelectionRecord
                {
                    LibraryId = id,
                    Enabled = configuration.AutoEnableNewSupportedLibraries
                });
                changed = true;
            }
        }

        return changed;
    }
}
