import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {Subscription} from 'react-native-ble-plx';
import BleModule from './BleModule';

// 注意: 需要确保全局只有一个BleManager实例，因为BleModule类保存着蓝牙的连接信息
const BluetoothManager = new BleModule();

const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [scaning, setScaning] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [text, setText] = useState('');
  const [writeData, setWriteData] = useState('');
  const [receiveData, setReceiveData] = useState('');
  const [readData, setReadData] = useState('');
  const [data, setData] = useState<any[]>([]);

  /** 蓝牙接收的数据缓存 */
  const bleReceiveData = useRef<any[]>([]);
  /** 使用Map类型保存搜索到的蓝牙设备，确保列表不显示重复的设备 */
  const deviceMap = useRef(new Map());

  const scanTimer = useRef<number>();
  const disconnectListener = useRef<Subscription>();
  const monitorListener = useRef<Subscription>();

  useEffect(() => {
    // 监听蓝牙开关
    const onStateChangeListener = BluetoothManager.manager.onStateChange(
      state => {
        console.log('onStateChange: ', state);
        if (state == 'PoweredOn') {
          scan();
        }
      },
    );

    return () => {
      BluetoothManager.destroy();
      onStateChangeListener?.remove();
      disconnectListener.current?.remove();
      monitorListener.current?.remove();
    };
  }, []);

  function alert(text: string) {
    Alert.alert('提示', text, [{text: '确定', onPress: () => {}}]);
  }

  function scan() {
    if (!scaning) {
      setScaning(true);
      deviceMap.current.clear();
      BluetoothManager.manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log('startDeviceScan error:', error);
          if (error.errorCode == 102) {
            alert('请打开手机蓝牙后再搜索');
          }
          setScaning(false);
        } else {
          console.log(device!.id, device!.name);
          deviceMap.current.set(device!.id, device);
          setData([...deviceMap.current.values()]);
        }
      });
      scanTimer.current && clearTimeout(scanTimer.current);
      scanTimer.current = setTimeout(() => {
        if (scaning) {
          BluetoothManager.stopScan();
          setScaning(false);
        }
      }, 1000); // 1秒后停止搜索
    } else {
      BluetoothManager.stopScan();
      setScaning(false);
    }
  }

  function connect(item: any) {
    if (scaning) {
      //连接的时候正在扫描，先停止扫描
      BluetoothManager.stopScan();
      setScaning(false);
    }
    if (BluetoothManager.isConnecting) {
      console.log('当前蓝牙正在连接时不能打开另一个连接进程');
      return;
    }
    let newData = [...deviceMap.current.values()];
    // 正在连接中
    newData[item.index].isConnecting = true;
    setData(newData);
    BluetoothManager.connect(item.item.id)
      .then(device => {
        newData[item.index].isConnecting = false;
        setData([newData[item.index]]);
        setIsConnected(true);
        onDisconnect();
      })
      .catch(err => {
        newData[item.index].isConnecting = false;
        setData([...newData]);
        alert(err);
      });
  }

  function read(index: number) {
    BluetoothManager.read(index)
      .then((value: any) => {
        setReadData(value);
      })
      .catch(err => {});
  }

  function write(index: number) {
    if (text.length == 0) {
      alert('请输入消息');
      return;
    }
    BluetoothManager.write(text, index)
      .then(characteristic => {
        bleReceiveData.current = [];
        setWriteData(text);
        setText('');
      })
      .catch(err => {});
  }

  function writeWithoutResponse(index: number) {
    if (text.length == 0) {
      alert('请输入消息');
      return;
    }
    BluetoothManager.writeWithoutResponse(text, index)
      .then(characteristic => {
        bleReceiveData.current = [];
        setWriteData(text);
        setText('');
      })
      .catch(err => {});
  }

  /** 监听蓝牙数据 */
  function monitor(index: number) {
    let transactionId = 'monitor';
    monitorListener.current =
      BluetoothManager.manager.monitorCharacteristicForDevice(
        BluetoothManager.peripheralId,
        BluetoothManager.nofityServiceUUID[index],
        BluetoothManager.nofityCharacteristicUUID[index],
        (error, characteristic) => {
          if (error) {
            setIsMonitoring(false);
            console.log('monitor fail:', error);
            alert('monitor fail: ' + error.reason);
          } else {
            setIsMonitoring(false);
            bleReceiveData.current.push(characteristic!.value); //数据量多的话会分多次接收
            setReceiveData(bleReceiveData.current.join(''));
            console.log('monitor success', characteristic!.value);
            // alert('开启成功');
          }
        },
        transactionId,
      );
  }

  /** 监听蓝牙断开 */
  function onDisconnect() {
    disconnectListener.current = BluetoothManager.manager.onDeviceDisconnected(
      BluetoothManager.peripheralId,
      (error, device) => {
        if (error) {
          //蓝牙遇到错误自动断开
          console.log('onDeviceDisconnected', 'device disconnect', error);
          setData([...deviceMap.current.values()]);
          setIsConnected(false);
        } else {
          disconnectListener.current && disconnectListener.current.remove();
          console.log(
            'onDeviceDisconnected',
            'device disconnect',
            device!.id,
            device!.name,
          );
        }
      },
    );
  }

  /** 断开蓝牙连接 */
  function disconnect() {
    BluetoothManager.disconnect()
      .then(res => {
        setData([...deviceMap.current.values()]);
        setIsConnected(false);
      })
      .catch(err => {
        setData([...deviceMap.current.values()]);
        setIsConnected(false);
      });
  }

  function renderItem(item: any) {
    let data = item.item;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={isConnected ? true : false}
        onPress={() => {
          connect(item);
        }}
        style={styles.item}>
        <View style={{flexDirection: 'row'}}>
          <Text style={{color: 'black'}}>{data.name ? data.name : ''}</Text>
          <Text style={{color: 'red', marginLeft: 50}}>
            {data.isConnecting ? '连接中...' : ''}
          </Text>
        </View>
        <Text>{data.id}</Text>
      </TouchableOpacity>
    );
  }

  function renderHeader() {
    return (
      <View style={{marginTop: 20}}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.buttonView,
            {marginHorizontal: 10, height: 40, alignItems: 'center'},
          ]}
          onPress={isConnected ? disconnect : scan}>
          <Text style={styles.buttonText}>
            {scaning ? '正在搜索中' : isConnected ? '断开蓝牙' : '搜索蓝牙'}
          </Text>
        </TouchableOpacity>

        <Text style={{marginLeft: 10, marginTop: 10}}>
          {isConnected ? '当前连接的设备' : '可用设备'}
        </Text>
      </View>
    );
  }

  function renderFooter() {
    return (
      <View style={{marginBottom: 30}}>
        {isConnected ? (
          <View>
            {renderWriteView(
              '写数据(write)：',
              '发送',
              BluetoothManager.writeWithResponseCharacteristicUUID,
              write,
            )}
            {renderWriteView(
              '写数据(writeWithoutResponse)：',
              '发送',
              BluetoothManager.writeWithoutResponseCharacteristicUUID,
              writeWithoutResponse,
            )}
            {renderReceiveView(
              '读取的数据：',
              '读取',
              BluetoothManager.readCharacteristicUUID,
              read,
              readData,
            )}
            {renderReceiveView(
              `监听接收的数据：${isMonitoring ? '监听已开启' : '监听未开启'}`,
              '开启监听',
              BluetoothManager.nofityCharacteristicUUID,
              monitor,
              receiveData,
            )}
          </View>
        ) : (
          <View style={{marginBottom: 20}}></View>
        )}
      </View>
    );
  }

  function renderWriteView(
    label: string,
    buttonText: string,
    characteristics: any[],
    onPress: (index: number) => void,
  ) {
    if (characteristics.length == 0) {
      return null;
    }
    return (
      <View style={{marginHorizontal: 10, marginTop: 30}}>
        <Text style={{color: 'black'}}>{label}</Text>
        <Text style={styles.content}>{writeData}</Text>
        {characteristics.map((item, index) => {
          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              style={styles.buttonView}
              onPress={() => {
                onPress(index);
              }}>
              <Text style={styles.buttonText}>
                {buttonText} ({item})
              </Text>
            </TouchableOpacity>
          );
        })}
        <TextInput
          style={[styles.textInput]}
          value={text}
          placeholder="请输入消息"
          onChangeText={text => {
            setText(text);
          }}
        />
      </View>
    );
  }

  function renderReceiveView(
    label: string,
    buttonText: string,
    characteristics: any[],
    onPress: (index: number) => void,
    state: any,
  ) {
    if (characteristics.length == 0) {
      return null;
    }
    return (
      <View style={{marginHorizontal: 10, marginTop: 30}}>
        <Text style={{color: 'black', marginTop: 5}}>{label}</Text>
        <Text style={styles.content}>{state}</Text>
        {characteristics.map((item, index) => {
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.buttonView}
              onPress={() => {
                onPress(index);
              }}
              key={index}>
              <Text style={styles.buttonText}>
                {buttonText} ({item})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        renderItem={renderItem}
        keyExtractor={item => item.id}
        data={data}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        extraData={[
          isConnected,
          text,
          receiveData,
          readData,
          writeData,
          isMonitoring,
          scaning,
        ]}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  item: {
    flexDirection: 'column',
    borderColor: 'rgb(235,235,235)',
    borderStyle: 'solid',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 10,
    paddingVertical: 8,
  },
  buttonView: {
    height: 30,
    backgroundColor: 'rgb(33, 150, 243)',
    paddingHorizontal: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
  },
  content: {
    marginTop: 5,
    marginBottom: 15,
  },
  textInput: {
    paddingLeft: 5,
    paddingRight: 5,
    backgroundColor: 'white',
    height: 50,
    fontSize: 16,
    flex: 1,
  },
});

export default App;
