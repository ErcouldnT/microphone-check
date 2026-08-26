import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';
import { UserRole, getMyRole, setMyRole, getMyName, setMyName, getPartnerName, setPartnerName } from '@/db/settings';

interface ProfileRoleModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (role: UserRole, myName: string, partnerName: string) => void;
}

export default function ProfileRoleModal({ visible, onClose, onSaved }: ProfileRoleModalProps) {
  const [role, setRole] = useState<UserRole>('male');
  const [myName, setMyNameState] = useState('');
  const [partnerName, setPartnerNameState] = useState('');

  useEffect(() => {
    if (visible) {
      getMyRole().then(setRole);
      getMyName().then(setMyNameState);
      getPartnerName().then(setPartnerNameState);
    }
  }, [visible]);

  const handleSave = async () => {
    await setMyRole(role);
    await setMyName(myName.trim());
    await setPartnerName(partnerName.trim());
    onSaved(role, myName.trim(), partnerName.trim());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/85"
      >
        <View className="bg-gray-950 rounded-t-3xl border-t border-gray-800 p-5 max-h-[85%]">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center">
              <FontAwesome name="user-circle-o" size={20} color="#00FFFF" style={{ marginRight: 8 }} />
              <Text className="text-xl font-extrabold text-white">{i18n.t('myProfile')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2">
              <FontAwesome name="times" size={20} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Role / Gender Switcher */}
          <View className="mb-4">
            <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">
              {i18n.t('whoAreYou')}
            </Text>
            <View className="flex-row bg-gray-900 border border-gray-800 p-1.5 rounded-2xl">
              <TouchableOpacity
                onPress={() => setRole('male')}
                className={`flex-1 py-3 rounded-xl items-center ${
                  role === 'male' ? 'bg-cyan-950 border border-neonCyan' : ''
                }`}
              >
                <Text className={`font-extrabold text-sm ${role === 'male' ? 'text-neonCyan' : 'text-gray-400'}`}>
                  {i18n.t('maleOption')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setRole('female')}
                className={`flex-1 py-3 rounded-xl items-center ${
                  role === 'female' ? 'bg-pink-950 border border-neonPink' : ''
                }`}
              >
                <Text className={`font-extrabold text-sm ${role === 'female' ? 'text-neonPink' : 'text-gray-400'}`}>
                  {i18n.t('femaleOption')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* My Name */}
          <View className="mb-4">
            <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1.5">
              Senin İsmin (İsteğe bağlı)
            </Text>
            <TextInput
              value={myName}
              onChangeText={setMyNameState}
              placeholder="Örn: Erkut"
              placeholderTextColor="#555"
              className="bg-gray-900 border border-gray-800 text-white p-3.5 rounded-xl text-base font-semibold"
            />
          </View>

          {/* Partner Name */}
          <View className="mb-6">
            <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1.5">
              Partnerinin İsmi (İsteğe bağlı)
            </Text>
            <TextInput
              value={partnerName}
              onChangeText={setPartnerNameState}
              placeholder="Örn: Partner"
              placeholderTextColor="#555"
              className="bg-gray-900 border border-gray-800 text-white p-3.5 rounded-xl text-base font-semibold"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            className="bg-neonCyan p-4 rounded-xl flex-row items-center justify-center mb-4"
          >
            <FontAwesome name="check" size={16} color="#000" style={{ marginRight: 6 }} />
            <Text className="text-black font-extrabold text-base">{i18n.t('save')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
