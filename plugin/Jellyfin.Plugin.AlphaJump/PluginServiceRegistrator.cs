using Jellyfin.Plugin.AlphaJump.Web;
using Jellyfin.Plugin.AlphaJump.Configuration;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.AlphaJump;

/// <summary>
/// Registers the stock ASP.NET Core startup filter that places the narrowly
/// scoped Web-index middleware before Jellyfin's static-file middleware.
/// </summary>
public sealed class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton<IAlphaJumpConfigurationService, AlphaJumpConfigurationService>();
        serviceCollection.AddTransient<IStartupFilter, AlphaJumpStartupFilter>();
    }
}
