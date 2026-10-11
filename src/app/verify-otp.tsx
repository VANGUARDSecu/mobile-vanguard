import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import VerifyOtpScreen from '@/screens/verify-otp-screen';

export default function VerifyOtpRoute() {
  const params = useLocalSearchParams<{ email?: string; hasTotp?: string }>();
  const email = typeof params.email === 'string' ? params.email : undefined;
  const hasTotp = params.hasTotp === 'true';

  return (
    <VerifyOtpScreen
      email={email}
      hasTotp={hasTotp}
      onSuccess={() => router.replace('/')}
      onBack={() => router.replace('/login')}
    />
  );
}
