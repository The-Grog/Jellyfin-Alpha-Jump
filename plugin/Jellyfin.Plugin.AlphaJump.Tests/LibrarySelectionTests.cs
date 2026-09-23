using System.Reflection;
using System.Xml.Serialization;
using Jellyfin.Plugin.AlphaJump.Configuration;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using Xunit;

namespace Jellyfin.Plugin.AlphaJump.Tests;

public class LibrarySelectionTests
{
    [Fact]
    public void XmlRoundTripPreservesDefaultsAndExplicitSelections()
    {
        var defaults = RoundTrip(new PluginConfiguration());
        Assert.True(defaults.Enabled);
        Assert.True(defaults.AutoEnableNewSupportedLibraries);
        Assert.True(defaults.BuiltInCollectionsEnabled);
        Assert.True(defaults.AutoDisablePagination);
        Assert.True(defaults.SmoothScroll);
        Assert.False(defaults.Debug);
        Assert.Empty(defaults.LibrarySelections);

        var enabled = Guid.Parse("01234567-89ab-cdef-0123-456789abcdef");
        var disabled = Guid.Parse("fedcba98-7654-3210-fedc-ba9876543210");
        var configuration = RoundTrip(new PluginConfiguration
        {
            BuiltInCollectionsEnabled = false,
            LibrarySelections =
            [
                new LibrarySelectionRecord { LibraryId = LibraryId.Normalize(enabled), Enabled = true },
                new LibrarySelectionRecord { LibraryId = LibraryId.Normalize(disabled), Enabled = false }
            ]
        });

        Assert.True(LibrarySelection.IsEnabled(configuration, enabled));
        Assert.False(LibrarySelection.IsEnabled(configuration, disabled));
        Assert.False(configuration.BuiltInCollectionsEnabled);
        configuration.Enabled = false;
        Assert.False(LibrarySelection.IsEnabled(configuration, enabled));
        Assert.True(LibrarySelection.IsSelectionEnabled(configuration, enabled));
    }

    [Fact]
    public void DiscoveryPersistsInitialAndNewLibraryStateWithoutRewritingExistingSelections()
    {
        var existing = Guid.NewGuid();
        var newLibrary = Guid.NewGuid();
        var configuration = new PluginConfiguration { AutoEnableNewSupportedLibraries = true };
        var initial = new[]
        {
            new LibraryDescriptor(existing, "Movies", "movies"),
            new LibraryDescriptor(Guid.NewGuid(), "Music", "music")
        };

        Assert.True(LibraryDiscoverySynchronizer.Synchronize(configuration, initial));
        Assert.True(LibrarySelection.IsEnabled(configuration, existing));
        Assert.Equal(2, configuration.LibrarySelections.Count);

        configuration.AutoEnableNewSupportedLibraries = false;
        Assert.True(LibraryDiscoverySynchronizer.Synchronize(configuration,
            initial.Append(new LibraryDescriptor(newLibrary, "Shows", "tvshows"))));
        Assert.True(LibrarySelection.IsEnabled(configuration, existing));
        Assert.False(LibrarySelection.IsEnabled(configuration, newLibrary));
    }

    [Fact]
    public void ExplicitChoicesSurviveRenameReloadPolicyChangeAndDeletedLibraries()
    {
        var selected = Guid.NewGuid();
        var configuration = new PluginConfiguration { AutoEnableNewSupportedLibraries = true };
        LibraryDiscoverySynchronizer.Synchronize(configuration,
            [new LibraryDescriptor(selected, "Before rename", "movies")]);
        configuration.LibrarySelections.Single().Enabled = false;
        configuration.AutoEnableNewSupportedLibraries = false;

        Assert.False(LibraryDiscoverySynchronizer.Synchronize(configuration,
            [new LibraryDescriptor(selected, "After rename", "movies")]));
        Assert.False(LibrarySelection.IsEnabled(configuration, selected));
        Assert.False(LibraryDiscoverySynchronizer.Synchronize(configuration, []));
        Assert.Single(configuration.LibrarySelections);
        Assert.False(LibrarySelection.IsEnabled(configuration, selected));
    }

    [Fact]
    public void GuidNormalizationMatchesUnhyphenatedRoutesButRejectsDifferentIds()
    {
        var serverId = Guid.Parse("01234567-89ab-cdef-0123-456789abcdef");
        Assert.True(LibraryId.TryNormalize("0123456789abcdef0123456789abcdef", out var routeId));
        Assert.Equal(LibraryId.Normalize(serverId), routeId);
        Assert.True(LibraryId.TryNormalize("fedcba9876543210fedcba9876543210", out var other));
        Assert.NotEqual(routeId, other);
    }

    [Theory]
    [InlineData("books")]
    [InlineData("boxsets")]
    [InlineData("homevideos")]
    [InlineData("mixed")]
    [InlineData("movies")]
    [InlineData("music")]
    [InlineData("musicvideos")]
    [InlineData("playlists")]
    [InlineData("tvshows")]
    [InlineData("")]
    [InlineData("unknown")]
    public void SourceBackedLibraryTypesAreSelectable(string collectionType)
    {
        var descriptor = new LibraryDescriptor(Guid.NewGuid(), "A library", collectionType);

        Assert.True(descriptor.IsSupported);
        if (string.IsNullOrEmpty(collectionType) || collectionType == "unknown")
        {
            Assert.Equal("mixed", descriptor.EffectiveCollectionType);
        }
    }

    [Fact]
    public void LiveTvAndUnknownLibraryTypesRemainDisabled()
    {
        var liveTv = new LibraryDescriptor(Guid.NewGuid(), "Live TV", "livetv");
        var unsupported = new LibraryDescriptor(Guid.NewGuid(), "Other", "games");

        Assert.False(liveTv.IsSupported);
        Assert.Contains("Live TV", liveTv.UnsupportedReason);
        Assert.False(unsupported.IsSupported);
        Assert.NotNull(unsupported.UnsupportedReason);
    }

    [Fact]
    public void AdministratorConfigurationShowsBuiltInLiveTvDisabledWithoutAnInventedId()
    {
        var configuration = new PluginConfiguration();
        var response = AlphaJumpConfigurationService.ToAdministratorConfiguration(
            configuration,
            [new LibraryDescriptor(Guid.NewGuid(), "Movies", "movies")]);

        var liveTv = Assert.Single(response.Libraries, library => library.CollectionType == "livetv");
        Assert.Equal(string.Empty, liveTv.LibraryId);
        Assert.False(liveTv.Supported);
        Assert.False(liveTv.Enabled);
        Assert.Contains("intentionally unsupported", liveTv.Explanation);
    }

    [Fact]
    public void DiscoveryUsesVirtualFoldersAndSkipsInvalidFolderIds()
    {
        var movieId = Guid.Parse("01234567-89ab-cdef-0123-456789abcdef");
        var libraryManager = DispatchProxy.Create<ILibraryManager, VirtualFolderLibraryManager>();
        var proxy = Assert.IsAssignableFrom<VirtualFolderLibraryManager>(libraryManager);
        proxy.VirtualFolders =
        [
            new VirtualFolderInfo { ItemId = movieId.ToString("D"), Name = "Movies", CollectionType = CollectionTypeOptions.movies },
            new VirtualFolderInfo { ItemId = Guid.NewGuid().ToString("D"), Name = "Books", CollectionType = CollectionTypeOptions.books },
            new VirtualFolderInfo { ItemId = Guid.NewGuid().ToString("D"), Name = "YouTube downloads", CollectionType = CollectionTypeOptions.homevideos },
            new VirtualFolderInfo { ItemId = "not-a-guid", Name = "Broken", CollectionType = CollectionTypeOptions.movies },
            new VirtualFolderInfo { ItemId = null, Name = "Missing", CollectionType = CollectionTypeOptions.tvshows }
        ];
        var skipped = new List<string>();

        var libraries = LibraryDiscovery.Discover(libraryManager, skipped.Add);

        Assert.Equal(3, libraries.Count);
        var library = Assert.Single(libraries, candidate => candidate.Id == movieId);
        Assert.Equal(movieId, library.Id);
        Assert.Equal("Movies", library.Name);
        Assert.Equal("movies", library.CollectionType);
        Assert.Contains(libraries, candidate => candidate.CollectionType == "books" && candidate.IsSupported);
        Assert.Contains(libraries, candidate => candidate.CollectionType == "homevideos" && candidate.IsSupported);
        Assert.Equal(1, proxy.GetVirtualFoldersCalls);
        Assert.Equal(0, proxy.RootFolderAccesses);
        Assert.Equal(["not-a-guid", "<null>"], skipped);
    }

    private static PluginConfiguration RoundTrip(PluginConfiguration configuration)
    {
        var serializer = new XmlSerializer(typeof(PluginConfiguration));
        using var writer = new StringWriter();
        serializer.Serialize(writer, configuration);
        using var reader = new StringReader(writer.ToString());
        return Assert.IsType<PluginConfiguration>(serializer.Deserialize(reader));
    }

    private class VirtualFolderLibraryManager : DispatchProxy
    {
        public List<VirtualFolderInfo> VirtualFolders { get; set; } = [];

        public int GetVirtualFoldersCalls { get; private set; }

        public int RootFolderAccesses { get; private set; }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name == nameof(ILibraryManager.GetVirtualFolders))
            {
                GetVirtualFoldersCalls++;
                return VirtualFolders;
            }

            if (targetMethod?.Name == "get_RootFolder")
            {
                RootFolderAccesses++;
                throw new InvalidOperationException("Discovery must not read RootFolder.VirtualChildren.");
            }

            throw new NotSupportedException(targetMethod?.Name);
        }
    }
}
