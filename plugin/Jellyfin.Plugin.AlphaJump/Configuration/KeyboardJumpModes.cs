namespace Jellyfin.Plugin.AlphaJump.Configuration;

/// <summary>Wire values for the optional browser keyboard alphabet shortcut.</summary>
public static class KeyboardJumpModes
{
    /// <summary>Keyboard shortcuts are disabled.</summary>
    public const string Off = "off";

    /// <summary>Shift+J arms a following alphabet key for two seconds.</summary>
    public const string Prefix = "prefix";

    /// <summary>An alphabet key immediately starts a jump.</summary>
    public const string Plain = "plain";

    /// <summary>
    /// Returns a recognized wire value. A missing legacy value receives the
    /// current default Prefix mode; an explicit unrecognized value fails closed.
    /// </summary>
    public static string Normalize(string? value)
    {
        return value switch
        {
            Off => Off,
            Prefix => Prefix,
            Plain => Plain,
            null => Prefix,
            _ => Off
        };
    }
}
