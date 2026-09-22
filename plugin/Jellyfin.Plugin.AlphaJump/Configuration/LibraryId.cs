namespace Jellyfin.Plugin.AlphaJump.Configuration;

/// <summary>Normalizes collection-folder identifiers at configuration boundaries.</summary>
public static class LibraryId
{
    /// <summary>Returns Jellyfin Web's unhyphenated lower-case GUID format.</summary>
    public static string Normalize(Guid libraryId) => libraryId.ToString("N");

    /// <summary>Parses either standard GUID spelling into the canonical route form.</summary>
    public static bool TryNormalize(string? value, out string normalized)
    {
        if (Guid.TryParse(value, out var id))
        {
            normalized = Normalize(id);
            return true;
        }

        normalized = string.Empty;
        return false;
    }
}
