import {Alert} from 'react-native';
import {BleManager} from 'react-native-ble-plx';
import {Buffer} from 'buffer';
import {byteToString} from './utils';

export default class BleModule {
  /** 蓝牙是否连接 */
  isConnecting: boolean;
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
    this.isConnecting = false;
    this.manager = new BleManager();
    this.initUUID();
  }

  /** 获取蓝牙UUID */
  async fetchServicesAndCharacteristicsForDevice(device: any) {
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

  /** 搜索蓝牙 */
  scan() {
    return new Promise((resolve, reject) => {
      this.manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log('startDeviceScan error:', error);
          if (error.errorCode == 102) {
            this.alert('请打开手机蓝牙后再搜索');
          }
          reject(error);
        } else {
          resolve(device);
        }
      });
    });
  }

  /** 停止搜索蓝牙 */
  stopScan() {
    this.manager.stopDeviceScan();
  }

  /** 连接蓝牙 */
  connect(id: string) {
    console.log('isConneting:', id);
    this.isConnecting = true;
    return new Promise((resolve, reject) => {
      this.manager
        .connectToDevice(id)
        .then(device => {
          console.log('connect success:', device.name, device.id);
          this.peripheralId = device.id;
          // resolve(device);
          return device.discoverAllServicesAndCharacteristics();
        })
        .then(device => {
          return this.fetchServicesAndCharacteristicsForDevice(device);
        })
        .then(services => {
          console.log('fetchServicesAndCharacteristicsForDevice', services);
          this.isConnecting = false;
          this.getUUID(services);
          resolve(null);
        })
        .catch(err => {
          this.isConnecting = false;
          console.log('connect fail: ', err);
          reject(err);
        });
    });
  }

  /**
   * 断开蓝牙
   * */
  disconnect() {
    return new Promise((resolve, reject) => {
      this.manager
        .cancelDeviceConnection(this.peripheralId)
        .then(res => {
          console.log('disconnect success', res);
          resolve(res);
        })
        .catch(err => {
          reject(err);
          console.log('disconnect fail', err);
        });
    });
  }

  /** 读取数据 */
  read(index: number) {
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
            this.alert('read fail: ' + error.reason);
            reject(error);
          },
        );
    });
  }

  /** 写数据 */
  write(value: string, index: number) {
    let formatValue: any;
    if (value === '0D0A') {
      //直接发送小票打印机的结束标志
      formatValue = value;
    } else {
      //发送内容，转换成base64编码
      formatValue = new Buffer(value, 'base64').toString('ascii');
    }
    let transactionId = 'write';
    return new Promise((resolve, reject) => {
      this.manager
        .writeCharacteristicWithResponseForDevice(
          this.peripheralId,
          this.writeWithResponseServiceUUID[index],
          this.writeWithResponseCharacteristicUUID[index],
          formatValue,
          transactionId,
        )
        .then(
          characteristic => {
            console.log('write success', value);
            resolve(characteristic);
          },
          error => {
            console.log('write fail: ', error);
            this.alert('write fail');
            reject(error);
          },
        );
    });
  }

  /** 写数据 withoutResponse */
  writeWithoutResponse(value: string, index: number) {
    let formatValue: any;
    if (value === '0D0A') {
      //直接发送小票打印机的结束标志
      formatValue = value;
    } else {
      //发送内容，转换成base64编码
      formatValue = new Buffer(value, 'base64').toString('ascii');
    }
    let transactionId = 'writeWithoutResponse';
    return new Promise((resolve, reject) => {
      this.manager
        .writeCharacteristicWithoutResponseForDevice(
          this.peripheralId,
          this.writeWithoutResponseServiceUUID[index],
          this.writeWithoutResponseCharacteristicUUID[index],
          formatValue,
          transactionId,
        )
        .then(
          characteristic => {
            console.log('writeWithoutResponse success', value);
            resolve(characteristic);
          },
          error => {
            console.log('writeWithoutResponse fail: ', error);
            this.alert('writeWithoutResponse fail');
            reject(error);
          },
        );
    });
  }

  /** 卸载蓝牙管理器 */
  destroy() {
    this.manager.destroy();
  }

  alert(text: string) {
    Alert.alert('提示', text, [{text: '确定', onPress: () => {}}]);
  }
}
