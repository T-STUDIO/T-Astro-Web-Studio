export class IndiGscService {
  /**
   * CCD Simulatorに対してKStarsと同等のGSC (Guide Star Catalog) 初期化・設定シーケンスを一括送信適用します。
   */
  public static applyGscSettings(
    device: string,
    driverConnection: any,
    mountDevice: string = 'Telescope Simulator',
    locationData?: { longitude: number; latitude: number; elevation: number }
  ): void {
    if (!device || !driverConnection) return;

    // 1. CCD Simulator への連動マウント指定 (ACTIVE_DEVICES)
    if (driverConnection.hasProperty(device, 'ACTIVE_DEVICES')) {
      driverConnection.sendRaw(
        `<newTextVector device='${device}' name='ACTIVE_DEVICES'>` +
          `<oneText name='ACTIVE_TELESCOPE'>${mountDevice}</oneText>` +
        `</newTextVector>`
      );
    }

    // 2. Mount (Telescope Simulator) の時刻同期 (TIME_UTC)
    if (driverConnection.hasProperty(mountDevice, 'TIME_UTC')) {
      const now = new Date();
      const isoTime = now.toISOString().split('.')[0];
      const offset = (-now.getTimezoneOffset() / 60).toString();
      driverConnection.sendRaw(
        `<newTextVector device='${mountDevice}' name='TIME_UTC'>` +
          `<oneText name='UTC'>${isoTime}</oneText>` +
          `<oneText name='OFFSET'>${offset}</oneText>` +
        `</newTextVector>`
      );
    }

    // 3. Mount への観測地情報設定 (GEOGRAPHIC_COORD)
    if (locationData && driverConnection.hasProperty(mountDevice, 'GEOGRAPHIC_COORD')) {
      driverConnection.sendRaw(
        `<newNumberVector device='${mountDevice}' name='GEOGRAPHIC_COORD'>` +
          `<oneNumber name='LONG'>${locationData.longitude}</oneNumber>` +
          `<oneNumber name='LAT'>${locationData.latitude}</oneNumber>` +
          `<oneNumber name='ELEV'>${locationData.elevation}</oneNumber>` +
        `</newNumberVector>`
      );
    }

    // 4. カタログデータソースとして GSC を選択 (SIMULATOR_CATALOG)
    // ※ 存在しない GSC_CONFIG や SIMULATOR_SETTINGS への不適切な TextVector 送信は削除
    if (driverConnection.hasProperty(device, 'SIMULATOR_CATALOG')) {
      driverConnection.sendRaw(
        `<newSwitchVector device='${device}' name='SIMULATOR_CATALOG'>` +
          `<oneSwitch name='GSC'>On</oneSwitch>` +
        `</newSwitchVector>`
      );
    }

    // 5. SCOPE_INFO (望遠鏡の光学情報: 焦点距離・口径) の同期設定送信
    // ※ エレメント名は TELESCOPE_FOCAL_LENGTH ではなく FOCAL_LENGTH / APERTURE です
    if (driverConnection.hasProperty(device, 'SCOPE_INFO')) {
      const focalLength = driverConnection.getNumericValue(mountDevice, 'TELESCOPE_INFO', 'TELESCOPE_FOCAL_LENGTH') || 
                          driverConnection.getNumericValue(mountDevice, 'TELESCOPE_TYPE', 'TELESCOPE_FOCAL_LENGTH') || 1000;
      const aperture = driverConnection.getNumericValue(mountDevice, 'TELESCOPE_INFO', 'TELESCOPE_APERTURE') || 
                       driverConnection.getNumericValue(mountDevice, 'TELESCOPE_TYPE', 'TELESCOPE_APERTURE') || 200;
      driverConnection.sendRaw(
        `<newNumberVector device='${device}' name='SCOPE_INFO'>` +
          `<oneNumber name='FOCAL_LENGTH'>${focalLength}</oneNumber>` +
          `<oneNumber name='APERTURE'>${aperture}</oneNumber>` +
        `</newNumberVector>`
      );
    }
  }
}

