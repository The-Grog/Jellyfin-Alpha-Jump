using System.Security.Cryptography;
using System.Text;

namespace Jellyfin.Plugin.AlphaJump.Web;

/// <summary>Small, process-scoped identity for the embedded browser payload.</summary>
public interface IAlphaJumpRuntimeInfo
{
    /// <summary>Gets this process's generated runtime identifier.</summary>
    string RuntimeId { get; }
    /// <summary>Gets the SHA-256 fingerprint of the embedded browser script.</summary>
    string ScriptFingerprint { get; }
    /// <summary>Gets the loaded plugin assembly version for diagnostics.</summary>
    string PluginVersion { get; }
}

/// <summary>Computes script identity once for one Jellyfin/plugin process.</summary>
public sealed class AlphaJumpRuntimeInfo : IAlphaJumpRuntimeInfo
{
    private AlphaJumpRuntimeInfo(string runtimeId, string scriptFingerprint, string pluginVersion)
    {
        RuntimeId = runtimeId;
        ScriptFingerprint = scriptFingerprint;
        PluginVersion = pluginVersion;
    }

    /// <inheritdoc />
    public string RuntimeId { get; }

    /// <inheritdoc />
    public string ScriptFingerprint { get; }

    /// <inheritdoc />
    public string PluginVersion { get; }

    /// <summary>Creates metadata from the authoritative embedded script bytes.</summary>
    public static AlphaJumpRuntimeInfo Create(Stream script, Version? pluginVersion = null)
    {
        ArgumentNullException.ThrowIfNull(script);
        using var buffer = new MemoryStream();
        script.CopyTo(buffer);
        return Create(buffer.ToArray(), pluginVersion);
    }

    /// <summary>Creates deterministic fingerprint metadata for one runtime.</summary>
    internal static AlphaJumpRuntimeInfo Create(byte[] script, Version? pluginVersion = null)
    {
        ArgumentNullException.ThrowIfNull(script);
        return new AlphaJumpRuntimeInfo(
            Guid.NewGuid().ToString("N"),
            Convert.ToHexString(SHA256.HashData(script)).ToLowerInvariant(),
            pluginVersion?.ToString() ?? "0");
    }
}
