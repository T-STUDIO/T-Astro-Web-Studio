export class IndiGscService {
  /**
   * CCD Simulatorに対してKStarsと同等のGSC (Guide Star Catalog) 初期化・設定を一括適用します。
   */
  public static applyGscSettings(device: string, driverConnection: any, mountDevice: string = 'Telescope Simulator'): void {
    if (!device || !driverConnection) return;

    // 1. ACTIVE_DEVICES (ACTIVE_TELESCOPE) に連動するマウントデバイス名を設定
    if (driverConnection.hasProperty(device, 'ACTIVE_DEVICES')) {
      driverConnection.sendRaw(
        `<newTextVector device='${device}' name='ACTIVE_DEVICES'>` +
          `<oneText name='ACTIVE_TELESCOPE'>${mountDevice}</oneText>` +
        `</newTextVector>`
      );
    }

    // 2. GSCカタログスイッチの有効化 (SIM_GSC / GSC)
    if (driverConnection.hasProperty(device, 'SIMULATOR_SETTINGS')) {
      driverConnection.sendRaw(
        `<newSwitchVector device='${device}' name='SIMULATOR_SETTINGS'><oneSwitch name='SIM_GSC'>On</oneSwitch></newSwitchVector>`
      );
    }
    if (driverConnection.hasProperty(device, 'SIMULATOR_CATALOG')) {
      driverConnection.sendRaw(
        `<newSwitchVector device='${device}' name='SIMULATOR_CATALOG'><oneSwitch name='GSC'>On</oneSwitch></newSwitchVector>`
      );
    }

    // 3. GSC実行ファイルパスおよびデータディレクトリパスの設定
    if (driverConnection.hasProperty(device, 'GSC_CONFIG')) {
      driverConnection.sendRaw(
        `<newTextVector device='${device}' name='GSC_CONFIG'>` +
          `<oneText name='GSC_EXEC'>/usr/bin/gsc</oneText>` +
          `<oneText name='GSC_DIR'>/usr/share/gsc</oneText>` +
        `</newTextVector>`
      );
    } else if (driverConnection.hasProperty(device, 'SIMULATOR_SETTINGS')) {
      driverConnection.sendRaw(
        `<newTextVector device='${device}' name='SIMULATOR_SETTINGS'>` +
          `<oneText name='GSC_EXEC'>/usr/bin/gsc</oneText>` +
          `<oneText name='GSC_DIR'>/usr/share/gsc</oneText>` +
        `</newTextVector>`
      );
    }
  }
}
