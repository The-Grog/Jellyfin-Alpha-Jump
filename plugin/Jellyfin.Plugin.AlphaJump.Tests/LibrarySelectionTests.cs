using System.Xml.Serialization;
using Jellyfin.Plugin.AlphaJump.Configuration;
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
        Assert.True(defaults.AutoDisablePagination);
        Assert.True(defaults.SmoothScroll);
        Assert.False(defaults.Debug);
        Assert.Empty(defaults.LibrarySelections);

        var enabled = Guid.Parse("01234567-89ab-cdef-0123-456789abcdef");
        var disabled = Guid.Parse("fedcba98-7654-3210-fedc-ba9876543210");
        var configuration = RoundTrip(new PluginConfiguration
        {
            LibrarySelections =
            [
                new LibrarySelectionRecord { LibraryId = LibraryId.Normalize(enabled), Enabled = true },
                new LibrarySelectionRecord { LibraryId = LibraryId.Normalize(disabled), Enabled = false }
            ]
        });

        Assert.True(LibrarySelection.IsEnabled(configuration, enabled));
        Assert.False(LibrarySelection.IsEnabled(configuration, disabled));
        configuration.Enabled = false;
        Assert.False(LibrarySelection.IsEnabled(configuration, enabled));
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
        Assert.Single(configuration.LibrarySelections);

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

    private static PluginConfiguration RoundTrip(PluginConfiguration configuration)
    {
        var serializer = new XmlSerializer(typeof(PluginConfiguration));
        using var writer = new StringWriter();
        serializer.Serialize(writer, configuration);
        using var reader = new StringReader(writer.ToString());
        return Assert.IsType<PluginConfiguration>(serializer.Deserialize(reader));
    }
}
