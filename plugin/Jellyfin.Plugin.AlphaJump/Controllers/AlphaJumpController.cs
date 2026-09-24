using System.Net.Mime;
using Jellyfin.Plugin.AlphaJump.Configuration;
using Jellyfin.Plugin.AlphaJump.Web;
using MediaBrowser.Common.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.AlphaJump.Controllers;

/// <summary>
/// Serves the one embedded browser script and the minimal per-library browser
/// configuration contract. The client endpoint never enumerates libraries.
/// </summary>
[ApiController]
[Route("AlphaJump")]
public sealed class AlphaJumpController : ControllerBase
{
    private readonly IAlphaJumpConfigurationService _configurationService;
    private readonly IAlphaJumpRuntimeInfo _runtimeInfo;

    /// <summary>Initializes a new instance of the controller.</summary>
    public AlphaJumpController(IAlphaJumpConfigurationService configurationService, IAlphaJumpRuntimeInfo runtimeInfo)
    {
        _configurationService = configurationService;
        _runtimeInfo = runtimeInfo;
    }

    /// <summary>
    /// Serves the single authoritative embedded Alpha Jump source.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("alpha-jump.js")]
    [Produces("text/javascript")]
    public ActionResult GetScript()
    {
        var stream = typeof(Plugin).Assembly.GetManifestResourceStream(
            "Jellyfin.Plugin.AlphaJump.Resources.alpha-jump.js");
        if (stream is null)
        {
            return NotFound();
        }

        using (stream)
        using (var reader = new StreamReader(stream))
        {
            Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            return Content(reader.ReadToEnd(), "text/javascript; charset=utf-8");
        }
    }

    /// <summary>Returns only process and payload identity for update recovery.</summary>
    [AllowAnonymous]
    [HttpGet("runtime")]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<RuntimeInfoDto> GetRuntimeInfo()
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(new RuntimeInfoDto(_runtimeInfo.RuntimeId, _runtimeInfo.ScriptFingerprint, _runtimeInfo.PluginVersion));
    }

    /// <summary>
    /// Returns only the configuration for the caller's requested library ID or
    /// Jellyfin's built-in Collections route.
    /// Jellyfin's authenticated API client supplies the credential; this endpoint
    /// deliberately returns no library names or inventory.
    /// </summary>
    [Authorize]
    [HttpGet("client-config")]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<ClientConfigurationDto> GetClientConfiguration([FromQuery] Guid? libraryId, [FromQuery] string? scope)
    {
        try
        {
            ClientLibraryConfiguration configuration;
            string responseScope;
            string? responseLibraryId;
            if (string.Equals(scope, "collections", StringComparison.OrdinalIgnoreCase) && !libraryId.HasValue)
            {
                configuration = _configurationService.GetBuiltInCollectionsConfiguration();
                responseScope = "collections";
                responseLibraryId = null;
            }
            else if (string.IsNullOrEmpty(scope) && libraryId.HasValue)
            {
                configuration = _configurationService.GetClientConfiguration(libraryId.Value);
                responseScope = "library";
                responseLibraryId = LibraryId.Normalize(libraryId.Value);
            }
            else
            {
                return BadRequest();
            }
            Response.Headers.CacheControl = "no-store";
            return Ok(new ClientConfigurationDto(
                ContractVersion: 3,
                Scope: responseScope,
                LibraryId: responseLibraryId,
                Enabled: configuration.Enabled,
                LibraryEnabled: configuration.LibraryEnabled,
                AutoDisablePagination: configuration.AutoDisablePagination,
                SmoothScroll: configuration.SmoothScroll,
                Debug: configuration.Debug,
                KeyboardJumpMode: configuration.KeyboardJumpMode));
        }
        catch (InvalidOperationException)
        {
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    /// <summary>Gets the synchronized administrator configuration and all current folders.</summary>
    [Authorize(Policy = Policies.RequiresElevation)]
    [HttpGet("admin/config")]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<AdministratorConfiguration> GetAdministratorConfiguration()
    {
        try
        {
            Response.Headers.CacheControl = "no-store";
            return Ok(_configurationService.GetAdministratorConfiguration());
        }
        catch (InvalidOperationException)
        {
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    /// <summary>Saves administrator changes while retaining concurrently discovered choices.</summary>
    [Authorize(Policy = Policies.RequiresElevation)]
    [HttpPost("admin/config")]
    [Consumes(MediaTypeNames.Application.Json)]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<AdministratorConfiguration> SaveAdministratorConfiguration(
        [FromBody] AdministratorConfigurationUpdate update)
    {
        try
        {
            Response.Headers.CacheControl = "no-store";
            return Ok(_configurationService.SaveAdministratorConfiguration(update));
        }
        catch (InvalidOperationException)
        {
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }
}

/// <summary>
/// Explicit, narrow browser/server configuration contract.
/// </summary>
public sealed record ClientConfigurationDto(
    int ContractVersion,
    string Scope,
    string? LibraryId,
    bool Enabled,
    bool LibraryEnabled,
    bool AutoDisablePagination,
    bool SmoothScroll,
    bool Debug,
    string KeyboardJumpMode);

/// <summary>Minimal cache-busting and update-recovery contract.</summary>
public sealed record RuntimeInfoDto(string RuntimeId, string ScriptFingerprint, string PluginVersion);
