import {   
    Platform,
    Alert,
} from 'react-native'
import { BleManager, Base64 } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

export default class BleModule{
    constructor(){
	    this.isConnecting = false;  //蓝牙是否连接
        this.initUUID();
        this.manager = new BleManager();
    }

     /**
     * 获取蓝牙UUID
     * */
    async fetchServicesAndCharacteristicsForDevice(device) {
        var servicesMap = {}
        var services = await device.services()
    
        for (let service of services) {
          var characteristicsMap = {}
          var characteristics = await service.characteristics()
          
          for (let characteristic of characteristics) {
            characteristicsMap[characteristic.uuid] = {
              uuid: characteristic.uuid,
              isReadable: characteristic.isReadable,
              isWritableWithResponse: characteristic.isWritableWithResponse,
              isWritableWithoutResponse: characteristic.isWritableWithoutResponse,
              isNotifiable: characteristic.isNotifiable,
              isNotifying: characteristic.isNotifying,
              value: characteristic.value
            }
          }
    
          servicesMap[service.uuid] = {
            uuid: service.uuid,
            isPrimary: service.isPrimary,
            characteristicsCount: characteristics.length,
            characteristics: characteristicsMap
          }
        }
        return servicesMap
    }

    //检验UUID是否可用
     checkUUID(uuid){
        if(uuid == '' || uuid.length == 4 || uuid.length != 36){
            return false;
        }
        return true;
    }

    initUUID(){
        this.readServiceUUID = [];
        this.readCharacteristicUUID = [];   
        this.writeWithResponseServiceUUID = [];
        this.writeWithResponseCharacteristicUUID = [];
        this.writeWithoutResponseServiceUUID = [];
        this.writeWithoutResponseCharacteristicUUID = [];
        this.nofityServiceUUID = [];
        this.nofityCharacteristicUUID = [];  
    }

    //获取Notify、Read、Write、WriteWithoutResponse的serviceUUID和characteristicUUID
    getUUID(services){       
        this.readServiceUUID = [];
        this.readCharacteristicUUID = [];   
        this.writeWithResponseServiceUUID = [];
        this.writeWithResponseCharacteristicUUID = [];
        this.writeWithoutResponseServiceUUID = [];
        this.writeWithoutResponseCharacteristicUUID = [];
        this.nofityServiceUUID = [];
        this.nofityCharacteristicUUID = [];     

        for(let i in services){
            // console.log('service',services[i]);
            let charchteristic = services[i].characteristics;
            for(let j in charchteristic){
                // console.log('charchteristic',charchteristic[j]);                  
                if(charchteristic[j].isReadable){
                    this.readServiceUUID.push(services[i].uuid);
                    this.readCharacteristicUUID.push(charchteristic[j].uuid);        
                }
                if(charchteristic[j].isWritableWithResponse){
                    this.writeWithResponseServiceUUID.push(services[i].uuid);
                    this.writeWithResponseCharacteristicUUID.push(charchteristic[j].uuid);           
                }
                if(charchteristic[j].isWritableWithoutResponse){
                    this.writeWithoutResponseServiceUUID.push(services[i].uuid);
                    this.writeWithoutResponseCharacteristicUUID.push(charchteristic[j].uuid);           
                }
                if(charchteristic[j].isNotifiable){
                    this.nofityServiceUUID.push(services[i].uuid);
                    this.nofityCharacteristicUUID.push(charchteristic[j].uuid);     
                }            
            }                    
        }       
          
        console.log('readServiceUUID',this.readServiceUUID);
        console.log('readCharacteristicUUID',this.readCharacteristicUUID);
        console.log('writeWithResponseServiceUUID',this.writeWithResponseServiceUUID);
        console.log('writeWithResponseCharacteristicUUID',this.writeWithResponseCharacteristicUUID);
        console.log('writeWithoutResponseServiceUUID',this.writeWithoutResponseServiceUUID);
        console.log('writeWithoutResponseCharacteristicUUID',this.writeWithoutResponseCharacteristicUUID);
        console.log('nofityServiceUUID',this.nofityServiceUUID);
        console.log('nofityCharacteristicUUID',this.nofityCharacteristicUUID);    
    }  
    
    // /**
    //  * 搜索蓝牙
    //  * */
    // scan(){
    //     return new Promise( (resolve, reject) =>{
    //         this.manager.startDeviceScan(null, null, (error, device) => {
    //             if (error) {
    //                 if(error.code == 102){
    //                     this.alert('请打开手机蓝牙后再搜索');
    //                 }
    //                 console.log(error);        
    //                 reject(error);            
    //             }else{
    //                 // console.log(device);
    //                 console.log(device.id,device.name);
    //                 resolve(device);                        
    //             }              
    //         })

    //     });
    // }

    
     /**
     * 停止搜索蓝牙
     * */
    stopScan(){
        this.manager.stopDeviceScan();
        console.log('stopDeviceScan');
    }

    /**
     * 连接蓝牙
     * */
    connect(id){
        console.log('isConneting:',id);      
        this.isConnecting = true;  
        return new Promise( (resolve, reject) =>{
            this.manager.connectToDevice(id)
                .then(device=>{                           
                    console.log('connect success:',device.name,device.id);    
                    this.peripheralId = device.id;       
                    // resolve(device);
                    return device.discoverAllServicesAndCharacteristics();
                })
                .then(device=>{
                    return this.fetchServicesAndCharacteristicsForDevice(device)
                })
                .then(services=>{
                    console.log('fetchServicesAndCharacteristicsForDevice',services);    
                    this.isConnecting = false;
                    this.getUUID(services);     
                    resolve();                           
                })
                .catch(err=>{
                    this.isConnecting = false;
                    console.log('connect fail:',err);
                    reject(err);                    
                })
        });
    }

    /**
     * 断开蓝牙
     * */
    disconnect(){
        return new Promise( (resolve, reject) =>{
            this.manager.cancelDeviceConnection(this.peripheralId)
                .then(res=>{
                    console.log('disconnect success',res);
                    resolve(res);
                })
                .catch(err=>{
                    reject(err);
                    console.log('disconnect fail',err);
                })     
        });
    }

    /**
     * 读取数据 
     * */
    read(index){
        return new Promise( (resolve, reject) =>{
            this.manager.readCharacteristicForDevice(this.peripheralId,this.readServiceUUID[index], this.readCharacteristicUUID[index])
                .then(characteristic=>{                    
                    let value = Buffer.from(characteristic.value,'base64');                    
                    // let base64 = newValue.toString('base64')                                  
                    console.log('read success',value);
                    // console.log('read success',characteristic.value);
                    resolve(value);     
                },error=>{
                    console.log('read fail',error);
                    reject(error);
                })
        });
    }

    /**
     * 写数据 
     * */
    write(value,index){
        // let asciiValue = new Buffer(value, "base64").toString('ascii'); //转成ascii发送过去
        let hexValue = new Buffer(value, "base64").toString('hex');  //转成16进制数据发送过去
        let transactionId = 'write';
        return new Promise( (resolve, reject) =>{      
            this.manager.writeCharacteristicWithoutResponseForDevice(this.peripheralId,this.writeWithResponseServiceUUID[index], 
                this.writeWithResponseCharacteristicUUID[index],hexValue,transactionId)
                .then(characteristic=>{                    
                    console.log('write success',hexValue);
                    resolve(characteristic);
                },error=>{
                    console.log('write fail',error);
                    reject(error);
                })
        });
    }

     /**
     * 写数据 
     * */
    writeWithoutResponse(value,index){
        // let asciiValue = new Buffer(value, "base64").toString('ascii'); //转成ascii发送过去
        let hexValue = new Buffer(value, "base64").toString('hex'); //转成16进制数据发送过去
        let transactionId = 'writeWithoutResponse';
        return new Promise( (resolve, reject) =>{   
            this.manager.writeCharacteristicWithoutResponseForDevice(this.peripheralId, this.writeWithoutResponseServiceUUID[index], 
                this.writeWithoutResponseCharacteristicUUID[index],hexValue,transactionId)
                .then(characteristic=>{
                    console.log('writeWithoutResponse success',hexValue);
                    resolve(characteristic);
                },error=>{
                    console.log('writeWithoutResponse fail',error);
                    reject(error);
                })
        });
    }

     /**
     * 卸载蓝牙管理器
     * */
    destroy(){
        this.manager.destroy();
    }

    alert(text){
        Alert.alert('提示',text,[{ text:'确定',onPress:()=>{ } }]);
    }
}