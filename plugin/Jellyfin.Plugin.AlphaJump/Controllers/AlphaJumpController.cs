using System.Net.Mime;
using Jellyfin.Plugin.AlphaJump.Configuration;
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

    /// <summary>Initializes a new instance of the controller.</summary>
    public AlphaJumpController(IAlphaJumpConfigurationService configurationService)
    {
        _configurationService = configurationService;
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
            Response.Headers.CacheControl = "public, max-age=3600";
            return Content(reader.ReadToEnd(), "text/javascript; charset=utf-8");
        }
    }

    /// <summary>
    /// Returns only the configuration for the caller's requested library ID.
    /// Jellyfin's authenticated API client supplies the credential; this endpoint
    /// deliberately returns no library names or inventory.
    /// </summary>
    [Authorize]
    [HttpGet("client-config")]
    [Produces(MediaTypeNames.Application.Json)]
    public ActionResult<ClientConfigurationDto> GetClientConfiguration([FromQuery] Guid libraryId)
    {
        try
        {
            var configuration = _configurationService.GetClientConfiguration(libraryId);
            Response.Headers.CacheControl = "no-store";
            return Ok(new ClientConfigurationDto(
                ContractVersion: 1,
                LibraryId: LibraryId.Normalize(libraryId),
                Enabled: configuration.Enabled,
                LibraryEnabled: configuration.LibraryEnabled,
                AutoDisablePagination: configuration.AutoDisablePagination,
                SmoothScroll: configuration.SmoothScroll,
                Debug: configuration.Debug));
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
    string LibraryId,
    bool Enabled,
    bool LibraryEnabled,
    bool AutoDisablePagination,
    bool SmoothScroll,
    bool Debug);
