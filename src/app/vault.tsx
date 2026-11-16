import React from 'react';
import { AuthenticatorNavigator } from '@/screens/authenticator-navigator';

export default function VaultRoute() {
  return <AuthenticatorNavigator enableLivePushPolling={false} />;
}
