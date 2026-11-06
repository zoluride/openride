import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ActiveTripScreen } from './src/screens/ActiveTripScreen';
import { DocumentsScreen } from './src/screens/DocumentsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OfferScreen } from './src/screens/OfferScreen';
import { PhoneAuthScreen } from './src/screens/PhoneAuthScreen';
import { ReportIncidentScreen } from './src/screens/ReportIncidentScreen';
import { api } from './src/lib/api';
import { useSession } from './src/lib/auth';
import {
  REQUIRED_DRIVER_DOCUMENTS,
  mockAdminVerifyPendingDocuments,
  submitDriverDocuments,
  useDriverState,
  type DriverDocument,
  type RequiredDocumentName,
  type Vehicle,
} from './src/lib/driver-state';

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center' }} edges={['top', 'right', 'bottom', 'left']}>
      {children}
    </SafeAreaView>
  );
}

function SignedIn({ session }: { session: Session }) {
  const driverId = session.user.id;
  const displayName =
    (session.user.user_metadata?.display_name as string | undefined) ?? session.user.phone ?? null;
  const state = useDriverState(session);
  const [showReport, setShowReport] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  if (state.loading) {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  }

  if (showReport) {
    return <ReportIncidentScreen onDone={() => setShowReport(false)} />;
  }

  if (showDocuments) {
    return (
      <DocumentsScreen
        driverId={driverId}
        documents={state.driverDocuments}
        onBack={() => setShowDocuments(false)}
        onSubmit={async (uploadedTypes) => {
          await submitDriverDocuments(driverId, uploadedTypes);
          await state.refresh();
          setShowDocuments(false);
        }}
        onMockAdminVerify={async () => {
          await mockAdminVerifyPendingDocuments(driverId);
          await state.refresh();
          setShowDocuments(false);
        }}
      />
    );
  }

  // Active trip takes precedence, then a pending offer, then the home/idle view.
  if (state.activeTrip) {
    return (
      <ActiveTripScreen
        trip={state.activeTrip}
        onEvent={async (event, reason) => {
          await api.tripEvent(state.activeTrip!.id, event, reason);
          await state.refresh();
        }}
      />
    );
  }

  if (state.pendingOffer) {
    return (
      <OfferScreen
        offer={state.pendingOffer}
        onAccept={async (tripId) => {
          await api.acceptOffer(tripId);
          await state.refresh();
        }}
        onDecline={async (tripId) => {
          await api.declineOffer(tripId, 'driver declined');
          await state.refresh();
        }}
      />
    );
  }

  return (
    <HomeScreen
      driverId={driverId}
      displayName={displayName}
      online={state.online}
      grossEarningsNaira={state.grossEarningsNaira}
      completedTrips={state.completedTrips}
      completedTripsToday={state.completedTripsToday}
      hoursOnlineToday={state.hoursOnlineToday}
      driverDocuments={state.driverDocuments}
      onDocuments={() => setShowDocuments(true)}
      onGoOnline={state.goOnline}
      onGoOffline={state.goOffline}
      onReport={() => setShowReport(true)}
    />
  );
}

const DEV_BYPASS_DRIVER_ID = 'dev-bypass-driver';
const DEV_BYPASS_VEHICLES: Vehicle[] = [
  { id: 'dev-preview-vehicle', rego: 'DEV-001', make: 'OpenRide', model: 'Preview', vehicle_type: 'sedan' },
];

function DevBypassHome({ onExit }: { onExit: () => void }) {
  const [showDocuments, setShowDocuments] = useState(false);
  const [online, setOnline] = useState(false);
  const [driverDocuments, setDriverDocuments] = useState<DriverDocument[]>(
    REQUIRED_DRIVER_DOCUMENTS.map(({ type }) => ({ type, status: 'pending', uploaded: false })),
  );

  if (showDocuments) {
    return (
      <DocumentsScreen
        driverId={DEV_BYPASS_DRIVER_ID}
        documents={driverDocuments}
        onBack={() => setShowDocuments(false)}
        onSubmit={async (uploadedTypes: RequiredDocumentName[]) => {
          setDriverDocuments((documents) =>
            documents.map((document) =>
              uploadedTypes.includes(document.type) ? { ...document, uploaded: true } : document,
            ),
          );
          setShowDocuments(false);
        }}
        onMockAdminVerify={async () => {
          setDriverDocuments((documents) =>
            documents.map((document) =>
              document.uploaded ? { ...document, status: 'verified' } : document,
            ),
          );
          setShowDocuments(false);
        }}
      />
    );
  }

  return (
    <HomeScreen
      driverId={DEV_BYPASS_DRIVER_ID}
      displayName="Dev Preview Driver"
      online={online}
      grossEarningsNaira={0}
      completedTrips={350}
      completedTripsToday={0}
      hoursOnlineToday={0}
      driverDocuments={driverDocuments}
      mockVehicles={DEV_BYPASS_VEHICLES}
      onDocuments={() => setShowDocuments(true)}
      onSignOut={onExit}
      onGoOnline={async () => setOnline(true)}
      onGoOffline={async () => setOnline(false)}
      onReport={() => {}}
    />
  );
}

export default function App() {
  const { session, loading } = useSession();
  const [devBypass, setDevBypass] = useState(false);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {loading ? (
        <Centered>
          <ActivityIndicator />
        </Centered>
      ) : !session && __DEV__ && devBypass ? (
        <DevBypassHome onExit={() => setDevBypass(false)} />
      ) : !session ? (
        <PhoneAuthScreen onDevBypass={() => setDevBypass(true)} />
      ) : (
        <SignedIn session={session} />
      )}
    </SafeAreaProvider>
  );
}
