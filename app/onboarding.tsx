import React from 'react';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/onboarding/useOnboarding';
import { OnboardingView } from '@/ui/OnboardingView';

export default function OnboardingScreen() {
  const router = useRouter();
  const onboarding = useOnboarding();

  const handleFinish = () => {
    // Leva para a tela inicial ("Hoje")
    router.replace('/');
  };

  return <OnboardingView onboarding={onboarding} onFinish={handleFinish} />;
}
