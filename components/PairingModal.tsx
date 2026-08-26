import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';
import { syncService, ConnectionStatus } from '@/services/syncService';
import { notificationService, scheduleLocalNotification } from '@/services/notificationService';

interface PairingModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PairingModal({ visible, onClose }: PairingModalProps) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('local');
  const [serverUrlInput, setServerUrlInput] = useState(syncService.getServerUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);

  useEffect(() => {
    if (visible) {
      setActiveRoom(syncService.getRoomCode());
      setStatus(syncService.getStatus());
      setServerUrlInput(syncService.getServerUrl());
    }

    const unsubStatus = syncService.addStatusListener((newStatus) => {
      setStatus(newStatus);
      setActiveRoom(syncService.getRoomCode());
    });

    return () => {
      unsubStatus();
    };
  }, [visible]);

  const handleCreateRoom = async () => {
    setLoading(true);
    try {
      const res = await syncService.createRoom(true);
      if (res.success && res.roomCode) {
        setActiveRoom(res.roomCode);
        Alert.alert(i18n.t('sharedCalendar'), `${i18n.t('roomCode')}: ${res.roomCode}`);
      } else {
        Alert.alert(i18n.t('error'), res.error || 'Oda oluşturulamadı');
      }
    } catch (e: any) {
      Alert.alert(i18n.t('error'), e.message || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) {
      Alert.alert(i18n.t('error'), i18n.t('enterRoomCode'));
      return;
    }

    setLoading(true);
    try {
      const res = await syncService.joinRoom(roomCodeInput.trim());
      if (res.success) {
        setActiveRoom(roomCodeInput.trim().toUpperCase());
        setRoomCodeInput('');
        Alert.alert(i18n.t('sharedCalendar'), i18n.t('importSuccess'));
        onClose();
      } else {
        Alert.alert(i18n.t('error'), res.error || 'Odaya bağlanılamadı');
      }
    } catch (e: any) {
      Alert.alert(i18n.t('error'), e.message || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = () => {
    Alert.alert(
      i18n.t('leaveRoom'),
      i18n.t('leaveRoomConfirm'),
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        {
          text: i18n.t('leaveRoom'),
          style: 'destructive',
          onPress: async () => {
            await syncService.leaveRoom();
            setActiveRoom(null);
          }
        }
      ]
    );
  };

  const handleUploadLocalData = async () => {
    setLoading(true);
    try {
      const res = await syncService.pushAllLocalData();
      if (res.success) {
        Alert.alert(i18n.t('uploadSuccess'));
      } else {
        Alert.alert(i18n.t('error'), res.error || 'Yükleme başarısız');
      }
    } catch (e: any) {
      Alert.alert(i18n.t('error'), e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServerUrl = async () => {
    if (!serverUrlInput.trim()) return;
    await syncService.setServerUrl(serverUrlInput.trim());
    Alert.alert(i18n.t('serverSettings'), i18n.t('save'));
    setShowServerConfig(false);
  };

  const getStatusBadge = () => {
    if (!activeRoom) {
      return (
        <View className="flex-row items-center bg-gray-800 px-3 py-1.5 rounded-full">
          <View className="w-2.5 h-2.5 rounded-full bg-gray-400 mr-2" />
          <Text className="text-gray-400 text-xs font-bold">{i18n.t('localMode')}</Text>
        </View>
      );
    }

    switch (status) {
      case 'connected':
        return (
          <View className="flex-row items-center bg-green-950 border border-green-500 px-3 py-1.5 rounded-full">
            <View className="w-2.5 h-2.5 rounded-full bg-green-400 mr-2" />
            <Text className="text-green-400 text-xs font-bold">{i18n.t('live')}</Text>
          </View>
        );
      case 'connecting':
        return (
          <View className="flex-row items-center bg-yellow-950 border border-yellow-500 px-3 py-1.5 rounded-full">
            <ActivityIndicator size="small" color="#eab308" style={{ marginRight: 6 }} />
            <Text className="text-yellow-400 text-xs font-bold">{i18n.t('connecting')}</Text>
          </View>
        );
      case 'disconnected':
      default:
        return (
          <View className="flex-row items-center bg-red-950 border border-red-500 px-3 py-1.5 rounded-full">
            <View className="w-2.5 h-2.5 rounded-full bg-red-400 mr-2" />
            <Text className="text-red-400 text-xs font-bold">{i18n.t('offline')}</Text>
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/80"
      >
        <View className="bg-gray-950 rounded-t-3xl border-t border-gray-800 p-6 max-h-[90%]">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-5">
            <View className="flex-row items-center">
              <FontAwesome name="users" size={22} color="#00FFFF" style={{ marginRight: 10 }} />
              <Text className="text-2xl font-bold text-white">{i18n.t('sharedCalendar')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2">
              <FontAwesome name="times" size={20} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Status Header */}
            <View className="flex-row justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800 mb-6">
              <Text className="text-gray-300 font-medium">{i18n.t('pairWithFriend')}</Text>
              {getStatusBadge()}
            </View>

            {loading && (
              <View className="my-6 items-center">
                <ActivityIndicator size="large" color="#00FFFF" />
              </View>
            )}

            {activeRoom ? (
              /* ALREADY CONNECTED TO A ROOM */
              <View className="space-y-4">
                <View className="bg-gray-900 border border-neonCyan/50 p-5 rounded-2xl items-center mb-4">
                  <Text className="text-gray-400 text-xs uppercase tracking-widest mb-1">
                    {i18n.t('activeRoom')}
                  </Text>
                  <Text className="text-3xl font-extrabold text-neonCyan tracking-widest my-2">
                    {activeRoom}
                  </Text>
                  <Text className="text-gray-400 text-xs text-center mt-1 px-4">
                    {i18n.t('shareCodeHelp')}
                  </Text>
                </View>

                {/* Notification Diagnostic & Test */}
                <View className="bg-gray-900/90 border border-gray-800 p-4 rounded-2xl mb-4">
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center">
                      <FontAwesome name="bell" size={14} color="#00FFFF" style={{ marginRight: 6 }} />
                      <Text className="text-white text-xs font-bold">Kilit Ekranı Bildirimleri</Text>
                    </View>
                    <View className="bg-cyan-950 border border-neonCyan px-2 py-0.5 rounded-full">
                      <Text className="text-neonCyan text-[10px] font-bold">
                        {notificationService.getPushToken() ? 'Aktif ✅' : 'İzinli ✅'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={async () => {
                      await scheduleLocalNotification('🎉 Bildirim Testi', 'Microphone Check bildirim sistemi başarıyla çalışıyor!');
                      Alert.alert('Bildirim Gönderildi', 'Telefonunuzun bildirim panelini / kilit ekranını kontrol edin.');
                    }}
                    className="bg-gray-800/80 border border-gray-700 py-2.5 rounded-xl items-center flex-row justify-center mt-1"
                  >
                    <FontAwesome name="paper-plane" size={12} color="#00FFFF" style={{ marginRight: 6 }} />
                    <Text className="text-neonCyan text-xs font-bold">Test Bildirimi Gönder</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleUploadLocalData}
                  disabled={loading}
                  className="bg-gray-900 border border-purple-500 p-4 rounded-xl flex-row items-center justify-center mb-3"
                >
                  <FontAwesome name="refresh" size={16} color="#c084fc" style={{ marginRight: 8 }} />
                  <Text className="text-purple-400 font-bold">{i18n.t('uploadLocalData')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLeaveRoom}
                  disabled={loading}
                  className="bg-gray-900 border border-red-600/70 p-4 rounded-xl flex-row items-center justify-center mb-6"
                >
                  <FontAwesome name="sign-out" size={16} color="#ef4444" style={{ marginRight: 8 }} />
                  <Text className="text-red-400 font-bold">{i18n.t('leaveRoom')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* NOT IN A ROOM YET */
              <View>
                {/* Create Room Option */}
                <TouchableOpacity
                  onPress={handleCreateRoom}
                  disabled={loading}
                  className="bg-neonPink/20 border border-neonPink p-4 rounded-xl flex-row items-center justify-center mb-6"
                >
                  <FontAwesome name="plus-circle" size={18} color="#FF007F" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-base">{i18n.t('createNewRoom')}</Text>
                </TouchableOpacity>

                <View className="flex-row items-center my-3">
                  <View className="flex-1 h-[1px] bg-gray-800" />
                  <Text className="text-gray-500 mx-3 text-xs uppercase font-bold">{i18n.t('or')}</Text>
                  <View className="flex-1 h-[1px] bg-gray-800" />
                </View>

                {/* Join Room Option */}
                <View className="bg-gray-900 p-4 rounded-xl border border-gray-800 mt-2 mb-6">
                  <Text className="text-gray-300 font-bold mb-3">{i18n.t('joinExistingRoom')}</Text>
                  <TextInput
                    value={roomCodeInput}
                    onChangeText={(text: string) => setRoomCodeInput(text.toUpperCase())}
                    placeholder={i18n.t('enterRoomCode')}
                    placeholderTextColor="#555"
                    autoCapitalize="characters"
                    className="bg-black border border-gray-700 text-white font-bold text-lg p-3 rounded-lg text-center tracking-widest mb-3"
                  />
                  <TouchableOpacity
                    onPress={handleJoinRoom}
                    disabled={loading || !roomCodeInput.trim()}
                    className={`p-3.5 rounded-lg flex-row items-center justify-center ${
                      roomCodeInput.trim() ? 'bg-neonCyan' : 'bg-gray-800'
                    }`}
                  >
                    <FontAwesome
                      name="link"
                      size={16}
                      color={roomCodeInput.trim() ? '#000' : '#666'}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      className={`font-bold ${roomCodeInput.trim() ? 'text-black' : 'text-gray-500'}`}
                    >
                      {i18n.t('joinExistingRoom')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Advanced / Server URL Settings */}
            <View className="border-t border-gray-900 pt-4 mb-4">
              <TouchableOpacity
                onPress={() => setShowServerConfig(!showServerConfig)}
                className="flex-row justify-between items-center py-2"
              >
                <Text className="text-gray-500 text-xs font-semibold">{i18n.t('serverSettings')}</Text>
                <FontAwesome
                  name={showServerConfig ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color="#666"
                />
              </TouchableOpacity>

              {showServerConfig && (
                <View className="bg-gray-900/60 p-3 rounded-lg mt-2 border border-gray-800">
                  <Text className="text-gray-400 text-xs mb-1">{i18n.t('serverUrl')}</Text>
                  <TextInput
                    value={serverUrlInput}
                    onChangeText={setServerUrlInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-black border border-gray-700 text-gray-200 text-xs p-2 rounded mb-2"
                  />
                  <TouchableOpacity
                    onPress={handleSaveServerUrl}
                    className="bg-gray-800 p-2 rounded items-center"
                  >
                    <Text className="text-neonCyan text-xs font-bold">{i18n.t('save')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
