using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace Jellyfin.Plugin.AlphaJump.Web;

/// <summary>
/// Adds Alpha Jump's HTML middleware at the start of the server pipeline.
/// </summary>
public sealed class AlphaJumpStartupFilter : IStartupFilter
{
    /// <inheritdoc />
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return application =>
        {
            application.UseMiddleware<AlphaJumpInjectionMiddleware>();
            next(application);
        };
    }
}
