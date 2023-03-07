import {BleManager, Characteristic, Device} from 'react-native-ble-plx';
import {Buffer} from 'buffer';
import {alert, byteToString} from './utils';

export default class BleModule {
  peripheralId!: string;
  manager: BleManager;

  readServiceUUID!: any[];
  readCharacteristicUUID!: any[];
  writeWithResponseServiceUUID!: any[];
  writeWithResponseCharacteristicUUID!: any[];
  writeWithoutResponseServiceUUID!: any[];
  writeWithoutResponseCharacteristicUUID!: any[];
  nofityServiceUUID!: any[];
  nofityCharacteristicUUID!: any[];

  constructor() {
    this.manager = new BleManager();
    this.initUUID();
  }

  /** 获取蓝牙UUID */
  async fetchServicesAndCharacteristicsForDevice(device: Device) {
    var servicesMap = {} as Record<string, any>;
    var services = await device.services();

    for (let service of services) {
      var characteristicsMap = {} as Record<string, any>;
      var characteristics = await service.characteristics();

      for (let characteristic of characteristics) {
        characteristicsMap[characteristic.uuid] = {
          uuid: characteristic.uuid,
          isReadable: characteristic.isReadable,
          isWritableWithResponse: characteristic.isWritableWithResponse,
          isWritableWithoutResponse: characteristic.isWritableWithoutResponse,
          isNotifiable: characteristic.isNotifiable,
          isNotifying: characteristic.isNotifying,
          value: characteristic.value,
        };
      }

      servicesMap[service.uuid] = {
        uuid: service.uuid,
        isPrimary: service.isPrimary,
        characteristicsCount: characteristics.length,
        characteristics: characteristicsMap,
      };
    }
    return servicesMap;
  }

  initUUID() {
    this.readServiceUUID = [];
    this.readCharacteristicUUID = [];
    this.writeWithResponseServiceUUID = [];
    this.writeWithResponseCharacteristicUUID = [];
    this.writeWithoutResponseServiceUUID = [];
    this.writeWithoutResponseCharacteristicUUID = [];
    this.nofityServiceUUID = [];
    this.nofityCharacteristicUUID = [];
  }

  /** 获取Notify、Read、Write、WriteWithoutResponse的serviceUUID和characteristicUUID */
  getUUID(services: any) {
    this.readServiceUUID = [];
    this.readCharacteristicUUID = [];
    this.writeWithResponseServiceUUID = [];
    this.writeWithResponseCharacteristicUUID = [];
    this.writeWithoutResponseServiceUUID = [];
    this.writeWithoutResponseCharacteristicUUID = [];
    this.nofityServiceUUID = [];
    this.nofityCharacteristicUUID = [];

    for (let i in services) {
      // console.log('service',services[i]);
      let charchteristic = services[i].characteristics;
      for (let j in charchteristic) {
        // console.log('charchteristic',charchteristic[j]);
        if (charchteristic[j].isReadable) {
          this.readServiceUUID.push(services[i].uuid);
          this.readCharacteristicUUID.push(charchteristic[j].uuid);
        }
        if (charchteristic[j].isWritableWithResponse) {
          this.writeWithResponseServiceUUID.push(services[i].uuid);
          this.writeWithResponseCharacteristicUUID.push(charchteristic[j].uuid);
        }
        if (charchteristic[j].isWritableWithoutResponse) {
          this.writeWithoutResponseServiceUUID.push(services[i].uuid);
          this.writeWithoutResponseCharacteristicUUID.push(
            charchteristic[j].uuid,
          );
        }
        if (charchteristic[j].isNotifiable) {
          this.nofityServiceUUID.push(services[i].uuid);
          this.nofityCharacteristicUUID.push(charchteristic[j].uuid);
        }
      }
    }

    console.log('readServiceUUID', this.readServiceUUID);
    console.log('readCharacteristicUUID', this.readCharacteristicUUID);
    console.log(
      'writeWithResponseServiceUUID',
      this.writeWithResponseServiceUUID,
    );
    console.log(
      'writeWithResponseCharacteristicUUID',
      this.writeWithResponseCharacteristicUUID,
    );
    console.log(
      'writeWithoutResponseServiceUUID',
      this.writeWithoutResponseServiceUUID,
    );
    console.log(
      'writeWithoutResponseCharacteristicUUID',
      this.writeWithoutResponseCharacteristicUUID,
    );
    console.log('nofityServiceUUID', this.nofityServiceUUID);
    console.log('nofityCharacteristicUUID', this.nofityCharacteristicUUID);
  }

  /** 停止搜索蓝牙 */
  stopScan() {
    this.manager.stopDeviceScan();
  }

  /** 连接蓝牙 */
  connect(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.manager
        .connectToDevice(id)
        .then(device => {
          console.log('connect success:', device.name, device.id);
          this.peripheralId = device.id;
          return device.discoverAllServicesAndCharacteristics();
        })
        .then(device => {
          return this.fetchServicesAndCharacteristicsForDevice(device);
        })
        .then(services => {
          console.log('fetchServicesAndCharacteristicsForDevice', services);
          this.getUUID(services);
          resolve();
        })
        .catch(err => {
          console.log('connect fail: ', err);
          reject(err);
        });
    });
  }

  /** 断开蓝牙 */
  disconnect() {
    this.manager
      .cancelDeviceConnection(this.peripheralId)
      .then(res => {
        console.log('disconnect success', res);
      })
      .catch(err => {
        console.log('disconnect fail', err);
      });
  }

  /** 读取数据 */
  read(index: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.manager
        .readCharacteristicForDevice(
          this.peripheralId,
          this.readServiceUUID[index],
          this.readCharacteristicUUID[index],
        )
        .then(
          characteristic => {
            let buffer = Buffer.from(characteristic.value!, 'base64');
            // let value = buffer.toString();
            const value = byteToString(buffer);
            console.log('read success', buffer, value);
            resolve(value);
          },
          error => {
            console.log('read fail: ', error);
            alert('read fail: ' + error.reason);
            reject(error);
          },
        );
    });
  }

  /** 写数据 */
  write(value: string, index: number): Promise<Characteristic> {
    let formatValue: any;
    if (value === '0D0A') {
      //直接发送小票打印机的结束标志
      formatValue = value;
    } else {
      //发送内容，转换成base64编码
      formatValue = new Buffer(value, 'base64').toString('ascii');
    }
    return new Promise((resolve, reject) => {
      this.manager
        .writeCharacteristicWithResponseForDevice(
          this.peripheralId,
          this.writeWithResponseServiceUUID[index],
          this.writeWithResponseCharacteristicUUID[index],
          formatValue,
        )
        .then(
          characteristic => {
            console.log('write success', value);
            resolve(characteristic);
          },
          error => {
            console.log('write fail: ', error);
            alert('write fail');
            reject(error);
          },
        );
    });
  }

  /** 写数据 withoutResponse */
  writeWithoutResponse(value: string, index: number): Promise<Characteristic> {
    let formatValue: any;
    if (value === '0D0A') {
      //直接发送小票打印机的结束标志
      formatValue = value;
    } else {
      //发送内容，转换成base64编码
      formatValue = new Buffer(value, 'base64').toString('ascii');
    }
    return new Promise((resolve, reject) => {
      this.manager
        .writeCharacteristicWithoutResponseForDevice(
          this.peripheralId,
          this.writeWithoutResponseServiceUUID[index],
          this.writeWithoutResponseCharacteristicUUID[index],
          formatValue,
        )
        .then(
          characteristic => {
            console.log('writeWithoutResponse success', value);
            resolve(characteristic);
          },
          error => {
            console.log('writeWithoutResponse fail: ', error);
            alert('writeWithoutResponse fail');
            reject(error);
          },
        );
    });
  }

  /** 卸载蓝牙管理器 */
  destroy() {
    console.log('destroy');
    this.manager.destroy();
  }
}
