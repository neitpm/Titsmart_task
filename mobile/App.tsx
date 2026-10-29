import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAuthStore } from './src/services/authStore';
import { MobileUpdateModal } from './src/components/MobileUpdateModal';
import { registerForPushNotificationsAsync } from './src/services/notificationService';
import 'react-native-url-polyfill/auto';

export default function App() {
  const { user, initAuth, isLoading } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Đăng ký nhận Push Notification (ngay cả khi tắt ứng dụng)
  useEffect(() => {
    registerForPushNotificationsAsync(user?.id, user?.username);

    // Lắng nghe khi người dùng bấm vào thông báo trên điện thoại
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Người dùng đã bấm vào thông báo đẩy:', data);
    });

    return () => {
      responseListener.remove();
    };
  }, [user?.id, user?.username]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00236f" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AppNavigator />
      <MobileUpdateModal />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    color: '#475569',
    fontSize: 16,
  },
});
