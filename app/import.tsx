import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/theme';
import { useApkgImport } from '@/import/useApkgImport';
import { ImportView } from '@/ui/ImportView';

export default function ImportScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const importHook = useApkgImport();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      edges={['top', 'bottom']}
    >
      <ImportView
        selectedFile={importHook.selectedFile}
        preview={importHook.preview}
        scheduleMode={importHook.scheduleMode}
        onSelectScheduleMode={importHook.setScheduleMode}
        isLoadingPreview={importHook.isLoadingPreview}
        isImporting={importHook.isImporting}
        progress={importHook.progress}
        error={importHook.error}
        result={importHook.result}
        onPickFile={importHook.pickFile}
        onStartImport={importHook.startImport}
        onReset={importHook.reset}
        onBack={() => router.back()}
        onViewDecks={() => router.replace('/')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
