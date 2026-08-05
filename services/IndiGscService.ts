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

    // 4. GSC有効化スイッチおよび設定送信 (SIMULATOR_SETTINGS / SIMULATOR_CATALOG)
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

    // 5. GSCパスプロパティの設定送信 (GSC_CONFIG)
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

    // 6. SCOPE_INFO (望遠鏡の光学情報: 焦点距離・口径) の同期設定送信
    if (driverConnection.hasProperty(device, 'SCOPE_INFO')) {
      const focalLength = driverConnection.getNumericValue(mountDevice, 'TELESCOPE_INFO', 'TELESCOPE_FOCAL_LENGTH') || 
                          driverConnection.getNumericValue(mountDevice, 'TELESCOPE_TYPE', 'TELESCOPE_FOCAL_LENGTH') || 1000;
      const aperture = driverConnection.getNumericValue(mountDevice, 'TELESCOPE_INFO', 'TELESCOPE_APERTURE') || 
                       driverConnection.getNumericValue(mountDevice, 'TELESCOPE_TYPE', 'TELESCOPE_APERTURE') || 200;
      driverConnection.sendRaw(
        `<newNumberVector device='${device}' name='SCOPE_INFO'>` +
          `<oneNumber name='TELESCOPE_FOCAL_LENGTH'>${focalLength}</oneNumber>` +
          `<oneNumber name='TELESCOPE_APERTURE'>${aperture}</oneNumber>` +
        `</newNumberVector>`
      );
    }

    // 7. WCS (World Coordinate System) の有効化スイッチの設定送信
    if (driverConnection.hasProperty(device, 'WCS_CONTROL')) {
      driverConnection.sendRaw(
        `<newSwitchVector device='${device}' name='WCS_CONTROL'><oneSwitch name='WCS_ENABLE'>On</oneSwitch></newSwitchVector>`
      );
    }

    // 8. CCD_ROTATION (カメラ回転角度: KStarsデフォルト180度) の設定送信
    if (driverConnection.hasProperty(device, 'CCD_ROTATION')) {
      driverConnection.sendRaw(
        `<newNumberVector device='${device}' name='CCD_ROTATION'><oneNumber name='CCD_ROTATION_VALUE'>180</oneNumber></newNumberVector>`
      );
    }

    // 9. UPLOAD_MODE (画像転送モード: クライアントのみ) の設定送信
    if (driverConnection.hasProperty(device, 'UPLOAD_MODE')) {
      driverConnection.sendRaw(
        `<newSwitchVector device='${device}' name='UPLOAD_MODE'><oneSwitch name='UPLOAD_CLIENT'>On</oneSwitch></newSwitchVector>`
      );
    }
  }
}

