using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;

namespace Jellyfin.Plugin.AlphaJump.Configuration;

/// <summary>Maps Jellyfin's configured virtual-folder abstraction to Alpha Jump libraries.</summary>
internal static class LibraryDiscovery
{
    /// <summary>Gets current libraries through Jellyfin's supported virtual-folder API.</summary>
    internal static IReadOnlyList<LibraryDescriptor> Discover(ILibraryManager libraryManager, Action<string>? invalidItemId = null)
    {
        ArgumentNullException.ThrowIfNull(libraryManager);
        return FromVirtualFolders(libraryManager.GetVirtualFolders(), invalidItemId);
    }

    /// <summary>Converts valid virtual folders to stable Alpha Jump descriptors.</summary>
    internal static IReadOnlyList<LibraryDescriptor> FromVirtualFolders(
        IEnumerable<VirtualFolderInfo> virtualFolders,
        Action<string>? invalidItemId = null)
    {
        ArgumentNullException.ThrowIfNull(virtualFolders);
        var libraries = new List<LibraryDescriptor>();
        foreach (var folder in virtualFolders)
        {
            if (!Guid.TryParse(folder.ItemId, out var id))
            {
                invalidItemId?.Invoke(folder.ItemId ?? "<null>");
                continue;
            }

            libraries.Add(new LibraryDescriptor(
                id,
                folder.Name ?? string.Empty,
                folder.CollectionType?.ToString() ?? string.Empty));
        }

        return libraries
            .OrderBy(folder => folder.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }
}
