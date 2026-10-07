import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '@/ui/theme';
import { strings } from '@/ui/strings';
import { helloHtml } from '@/webview/generated/hello.html';

export default function HomeScreen() {
  const { theme } = useTheme();
  const [statusMessage, setStatusMessage] = useState(strings.common.loading);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setStatusMessage(data.message);
      }
    } catch {
      // Ignora mensagens que não sejam JSON
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.elevated }]}>
        <Text style={[styles.title, { color: theme.fg }]}>{strings.welcome.title}</Text>
        <Text style={[styles.subtitle, { color: theme.fgMuted }]}>{statusMessage}</Text>
      </View>
      <View style={styles.webviewContainer}>
        <WebView
          originWhitelist={['*']}
          source={{ html: helloHtml }}
          onMessage={handleMessage}
          style={styles.webview}
          scrollEnabled={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
