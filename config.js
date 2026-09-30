// Konfiguration der Baustellen-App. Client-ID und Tenant-ID sind keine Geheimnisse.
window.APP_CONFIG = {
  clientId: "683b93ff-627a-4d22-8630-d281b9eb2737",   // Anwendungs-ID (Client) aus der Entra-App-Registrierung
  tenantId: "67c40142-fc74-495c-9e3f-caba1da1b1d5",   // Verzeichnis-ID (Mandant)
  loginHint: "info@kulle-la.de",   // Firmenkonto vorgeben, damit nicht versehentlich das private Microsoft-Konto gewählt wird
  // Pfade relativ zum OneDrive-Stamm (dem Ordner "OneDrive - Kulle Landschaftsarchitektur")
  projekteRoot: "00_Kulle Landschaftsarchitektur/01_Projekte",
  datenRoot: "00_Kulle Landschaftsarchitektur/Baustellen-App/daten",
};
