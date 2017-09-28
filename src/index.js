import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Dimensions,
} from 'react-native';
import { BleManager, Base64 } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

export default class Main extends Component {
    constructor(props) {
        super(props);   
        this.state={
            scaning:false,
            isConnected:false,
            text:'',
            sendData:'',
            receiveData:'',
            PoweredOn:false,
            data:[]
        }
        this.bluetoothRreceiveData = [];  //蓝牙接收的数据缓存
        this.deviceMap = new Map();
        this.connectDevice = {};
    }

    componentWillMount(){
       this.BluetoothManager = new BleManager();
       this.BluetoothManager.onStateChange((state) => {
            console.log("onStateChange: ", state);
            if(state == 'PoweredOn'){
                this.setState({PoweredOn:true})
                this.scan();
            }
        })
    } 
    

    componentWillUnmount() {
       this.BluetoothManager.destroy();
       this.disconnectListener && this.disconnectListener.remove();
    }

    scan(){
        if(!this.state.scaning) {
            this.setState({scaning:true});
           this.BluetoothManager.startDeviceScan(null, null, (error, device) => {
                if (error) {
                    if(error.code == 102){
                        alert('请打开手机蓝牙后再搜索');
                        this.setState({scaning:false});
                    }
                    console.log(error)                    
                }else{
                    // console.log(device);
                    console.log(device.id,device.name);
                    this.deviceMap.set(device.id,device); //使用Map类型保存搜索到的蓝牙设备，确保列表不显示重复的设备
                    this.setState({data:[...this.deviceMap.values()]});                   
                }              
            })
            this.scanTimer && clearTimeout(this.scanTimer);
            this.scanTimer = setTimeout(()=>{
                if(this.state.scaning){                    
                   this.BluetoothManager.stopDeviceScan();
                   this.setState({scaning:false});
                   console.log('stopDeviceScan');
                }                
            },3000)  //自定义5秒后停止搜索
        }else {
            this.BluetoothManager.stopDeviceScan();
            this.setState({scaning:false});
            console.log('stopDeviceScan');
            
        }
    }

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

    getUUID(services){       
        this.readServiceUUID;
        this.readCharacteristicUUID;   
        this.writeWithResponseServiceUUID;
        this.writeWithResponseCharacteristicUUID;
        this.writeWithoutResponseServiceUUID;
        this.writeWithoutResponseCharacteristicUUID;
        this.nofityServiceUUID;
        this.nofityCharacteristicUUID;       

        for(let i in services){
            // console.log('service',services[i]);
            let charchteristic = services[i].characteristics;
            for(let j in charchteristic){
                // console.log('charchteristic',charchteristic[j]);                  
                if(!this.readServiceUUID && !this.readCharacteristicUUID && charchteristic[j].isReadable){
                    this.readServiceUUID = services[i].uuid;
                    this.readCharacteristicUUID = charchteristic[j].uuid;        
                }
                if(!this.writeServiceUUID && !this.writeCharacteristicUUID && charchteristic[j].isWritableWithResponse){
                    this.writeWithResponseServiceUUID = services[i].uuid;
                    this.writeWithResponseCharacteristicUUID = charchteristic[j].uuid;           
                }
                if(!this.writeWithoutResponseServiceUUID && !this.writeWithoutResponseCharacteristicUUID && charchteristic[j].isWritableWithoutResponse){
                    this.writeWithoutResponseServiceUUID = services[i].uuid;
                    this.writeWithoutResponseCharacteristicUUID = charchteristic[j].uuid;           
                }
                if(!this.nofityServiceUUID && !this.nofityCharacteristicUUID && charchteristic[j].isNotifiable){
                    this.nofityServiceUUID = services[i].uuid;
                    this.nofityCharacteristicUUID = charchteristic[j].uuid;     
                }                                     
            }                    
        }       
        if(this.nofityServiceUUID && this.nofityCharacteristicUUID ){
            // this.monitor();    
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

    connect(item){
        console.log('isConneting:',item.item.id);
        if(this.state.scaning){  //连接的时候正在扫描，先停止扫描
            this.BluetoothManager.stopDeviceScan();
            this.setState({scaning:false});
        }
        let newData = [...this.deviceMap.values()];
        newData[item.index].isConnecting = true;  //正在连ƒ接中
        this.setState({data:newData});
        this.BluetoothManager.connectToDevice(item.item.id)
            .then(device=>{        
                newData[item.index].isConnecting = false;
                this.setState({data:[device], isConnected:true});
                this.connectDevice = device;
                console.log('connect success:',device);
                this.onDisconnect();
                return device.discoverAllServicesAndCharacteristics();
            })
            .then(device=>{
                return this.fetchServicesAndCharacteristicsForDevice(device)
            })
            .then(services=>{
                console.log('fetchServicesAndCharacteristicsForDevice',services);    
                this.getUUID(services);                                
            })
            .catch(err=>{
                newData[item.index].isConnecting = false;
                this.setState({data:[...newData]});
                console.log('connect fail:',err);
                alert(err);
            })
    }

    read(){
        this.BluetoothManager.readCharacteristicForDevice(this.connectDevice.id,this.readServiceUUID,this.readCharacteristicUUID)
            .then(characteristic=>{
                let value = Buffer.from(characteristic.value,'base64');
                // let base64 = newValue.toString('base64')
                this.setState({receiveData:value})
                // console.log('read success',characteristic.value);
                console.log('read success',value);

            },rejected=>{
                console.log('read fail',rejected);
            })
    }

    write(value){
        let asciiValue = new Buffer(value, "base64").toString('ascii');
        let hexValue = new Buffer(value, "base64").toString('hex');

        let transactionId = 'write';
        this.BluetoothManager.writeCharacteristicWithoutResponseForDevice(this.connectDevice.id,this.writeWithResponseServiceUUID,
            this.writeWithResponseCharacteristicUUID,hexValue,transactionId)
            .then(characteristic=>{
                this.setState({sendData:hexValue});
                console.log('write success',characteristic);

            },rejected=>{
                console.log('write fail',rejected);
            })

    }

    writeWithoutResponse(value){
        let asciiValue = new Buffer(value, "base64").toString('ascii');
        let hexValue = new Buffer(value, "base64").toString('hex');

        let transactionId = 'writeWithoutResponse';
        this.BluetoothManager.writeCharacteristicWithoutResponseForDevice(this.connectDevice.id,this.writeWithoutResponseServiceUUID,
                    this.writeWithoutResponseCharacteristicUUID,hexValue,transactionId)
            .then(characteristic=>{
                console.log('writeWithoutResponse success',characteristic);

            },rejected=>{
                console.log('writeWithoutResponse fail',rejected);
            })
    }

    send(){        
        if(this.state.text.length == 0){
            alert('请输入消息');
            return;
        }
        this.write(this.state.text);       
        // this.writeWithoutResponse(this.state.text);       
    }

    monitor(){
        let transactionId = 'monitor';
        this.BluetoothManager.monitorCharacteristicForDevice(this.connectDevice.id,this.nofityServiceUUID,this.nofityCharacteristicUUID,
            (error, characteristic) => {
                if (error) {
                    console.log('monitor fail',error);            
                }else{
                    console.log('monitor success',characteristic)
                }

            }, transactionId)
    }  

    onDisconnect(){
        this.disconnectListener = this.BluetoothManager.onDeviceDisconnected(this.connectDevice.id,(error,device)=>{
            if(error){  //蓝牙遇到错误自动断开
                console.log('onDeviceDisconnected','device disconnect',error);
                this.setState({data:[...this.deviceMap.values()],isConnected:false});
            }else{
                this.disconnectListener && this.disconnectListener.remove();
                console.log('onDeviceDisconnected','device disconnect',device.id,device.name);
            }
        })
    }

    disconnect(){
        this.BluetoothManager.cancelDeviceConnection(this.connectDevice.id)
            .then(res=>{
                console.log('disconnect success',res);
                this.setState({data:[...this.deviceMap.values()],isConnected:false});
            })
            .catch(err=>{
                console.log('disconnect fail',err);
            })     
    }   

    renderItem=(item)=>{
        let data = item.item;
        return(
            <TouchableOpacity
                activeOpacity={0.7}
                disabled={this.state.isConnected?true:false}
                onPress={()=>{this.connect(item)}}
                style={styles.listRow}>          
                <Text style={{color:'black'}}>{data.name?data.name:'未知设备'}</Text>
                <View style={{flexDirection:'row',}}>
                    <Text>{data.id}</Text>
                    <Text style={{marginLeft:100,color:"red"}}>{data.isConnecting?'连接中...':''}</Text>
                </View>
               
            </TouchableOpacity>
        );
    }

    render () {
        return (
            <View style={styles.container}>  
               
                <TouchableOpacity 
                    activeOpacity={0.7}
                    onPress={this.state.isConnected?this.disconnect.bind(this):this.scan.bind(this)}>
                    <View style={[styles.buttonView,styles.center]}>
                        <Text style={styles.buttonText}>{this.state.scaning?'正在搜索中':this.state.isConnected?'断开蓝牙':'搜索蓝牙'}</Text>
                    </View>      
                </TouchableOpacity>
                
                <Text style={{marginLeft:10,marginTop:10}}>
                    {this.state.isConnected?'当前连接的设备':'可用设备'}
                </Text>

                <FlatList 
                    renderItem={this.renderItem}
                    keyExtractor={item=>item.id}
                    data={this.state.data}
                />                
                
                {this.state.isConnected?
                    <View style={{}}>
                        <Text style={{marginLeft:10,color:'black'}}>发送的数据：</Text>
                        <Text style={styles.content}>
                            {this.state.sendData}
                        </Text>
                        
                        <Text style={{marginLeft:10,marginTop:50,color:'black'}}>接收的数据：</Text>
                        <Text style={styles.content}>
                            {this.state.receiveData}
                        </Text>

                        <TouchableOpacity 
                            activeOpacity={0.7}
                            style={styles.sendButton}
                            onPress={this.read.bind(this)}>
                            <View style={[styles.buttonView,styles.center]}>
                                <Text style={styles.buttonText}>读取</Text>
                            </View>      
                        </TouchableOpacity>


                        <View style={{flexDirection:'row',marginTop:50}}>
                            <TextInput
                                style={[styles.textInput]}
                                value={this.state.text}
                                placeholder='消息'
                                onChangeText={(text)=>{
                                    this.setState({text:text});
                                }}
                            />                
                            <TouchableOpacity 
                                activeOpacity={0.7}
                                style={styles.sendButton}
                                onPress={this.send.bind(this)}>
                                <View style={[styles.buttonView,styles.center]}>
                                    <Text style={styles.buttonText}>发送</Text>
                                </View>      
                            </TouchableOpacity>
                        </View>
                       
                    </View>
                    : <View></View>
                }        
            </View>
        )
    }
}

const styles = StyleSheet.create({
    content:{
        paddingHorizontal:10,
        marginTop:5,
    },
    container: {
        flex: 1,
        backgroundColor:'white'
    },
    listRow:{
        flexDirection:'column',
        borderColor:'rgb(235,235,235)',
        borderStyle:'solid',
        borderBottomWidth:1,
        paddingLeft:10,
        paddingVertical:8,       
    },
    flatlist:{
        marginTop:10,
        marginBottom:30,
    },
    listStyle:{
        borderColor:'rgb(235,235,235)',
        borderStyle:'solid',
        borderTopWidth:1,
        marginLeft:10,
        marginRight:10,
    },
    center:{
        alignItems:"center",
        justifyContent:"center",        
    },
    buttonView:{
        paddingVertical:10,
        backgroundColor:'rgb(33, 150, 243)',
        marginHorizontal:10,
        marginTop:10,
        borderRadius:5,
    },
    buttonText:{
        color:"white"
    },
    textInput:{
		margin:10,
		paddingLeft:5,
		paddingRight:5,
		backgroundColor:'white',
		height:50,
		fontSize:16,
        width:Dimensions.get('window').width - 100,
	},
    sendButton:{
        width:80,
        marginTop:5,
    }
})



