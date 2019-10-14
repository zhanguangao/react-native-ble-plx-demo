import {   
    Platform,
    Alert,
} from 'react-native'
import { BleManager } from 'react-native-ble-plx';
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

    /**
     * 搜索蓝牙
     * */
    scan(){
        return new Promise( (resolve, reject) =>{
            this.manager.startDeviceScan(null, null, (error, device) => {
                if (error) {
                    console.log('startDeviceScan error:',error)
                    if(error.errorCode == 102){
                        this.alert('请打开手机蓝牙后再搜索');
                    }
                    reject(error);            
                }else{
                    resolve(device);                        
                }              
            })

        });
    }

    
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
                    console.log('connect fail: ',err);
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
                    let buffer = Buffer.from(characteristic.value,'base64');  
                    // let value = buffer.toString();       
                    const value = this.byteToString(buffer);          
                    console.log('read success', buffer, value);
                    resolve(value);     
                },error=>{
                    console.log('read fail: ',error);
                    this.alert('read fail: ' + error.reason);
                    reject(error);
                })
        });
    }

    /**
     * 写数据 
     * */
    write(value,index){
        let formatValue;      
        if(value === '0D0A') {  //直接发送小票打印机的结束标志
            formatValue = value;
        }else {  //发送内容，转换成base64编码
            formatValue = new Buffer(value, "base64").toString('ascii'); 
        }
        let transactionId = 'write';
        return new Promise( (resolve, reject) =>{      
            this.manager.writeCharacteristicWithResponseForDevice(this.peripheralId,this.writeWithResponseServiceUUID[index], 
                this.writeWithResponseCharacteristicUUID[index],formatValue,transactionId)
                .then(characteristic=>{                    
                    console.log('write success',value);
                    resolve(characteristic);
                },error=>{
                    console.log('write fail: ',error);
                    this.alert('write fail: ',error.reason);
                    reject(error);
                })
        });
    }

     /**
     * 写数据 withoutResponse
     * */
    writeWithoutResponse(value,index){
        let formatValue;      
        if(value === '0D0A') {  //直接发送小票打印机的结束标志
            formatValue = value;
        }else {  //发送内容，转换成base64编码
            formatValue = new Buffer(value, "base64").toString('ascii'); 
        }
        let transactionId = 'writeWithoutResponse';
        return new Promise( (resolve, reject) =>{   
            this.manager.writeCharacteristicWithoutResponseForDevice(this.peripheralId, this.writeWithoutResponseServiceUUID[index], 
                this.writeWithoutResponseCharacteristicUUID[index],formatValue,transactionId)
                .then(characteristic=>{
                    console.log('writeWithoutResponse success',value);
                    resolve(characteristic);
                },error=>{
                    console.log('writeWithoutResponse fail: ',error);
                    this.alert('writeWithoutResponse fail: ',error.reason);
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

     /**
     * 字符串转换成byte数组
     */
    stringToByte(str) {  
        var bytes = new Array();  
        var len, c;  
        len = str.length;  
        for(var i = 0; i < len; i++) {  
            c = str.charCodeAt(i);  
            if(c >= 0x010000 && c <= 0x10FFFF) {  
                bytes.push(((c >> 18) & 0x07) | 0xF0);  
                bytes.push(((c >> 12) & 0x3F) | 0x80);  
                bytes.push(((c >> 6) & 0x3F) | 0x80);  
                bytes.push((c & 0x3F) | 0x80);  
            } else if(c >= 0x000800 && c <= 0x00FFFF) {  
                bytes.push(((c >> 12) & 0x0F) | 0xE0);  
                bytes.push(((c >> 6) & 0x3F) | 0x80);  
                bytes.push((c & 0x3F) | 0x80);  
            } else if(c >= 0x000080 && c <= 0x0007FF) {  
                bytes.push(((c >> 6) & 0x1F) | 0xC0);  
                bytes.push((c & 0x3F) | 0x80);  
            } else {  
                bytes.push(c & 0xFF);  
            }  
        }  
        return bytes;      
    }      

    /**
     * byte数组转换成字符串
     */
    byteToString(arr) {  
        if(typeof arr === 'string') {  
            return arr;  
        }  
        var str = '',  
            _arr = arr;  
        for(var i = 0; i < _arr.length; i++) {  
            var one = _arr[i].toString(2),  
                v = one.match(/^1+?(?=0)/);  
            if(v && one.length == 8) {  
                var bytesLength = v[0].length;  
                var store = _arr[i].toString(2).slice(7 - bytesLength);  
                for(var st = 1; st < bytesLength; st++) {  
                    store += _arr[st + i].toString(2).slice(2);  
                }  
                str += String.fromCharCode(parseInt(store, 2));  
                i += bytesLength - 1;  
            } else {  
                str += String.fromCharCode(_arr[i]);  
            }  
        }  
        return str;  
    }  
}