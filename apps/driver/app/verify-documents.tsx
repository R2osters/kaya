import { toApiFailure } from "@kaya/core";
import {
  ImageAdapter,
  KayaButton,
  KayaCard,
  StatusPill,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { Check, Upload } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useUploadDocument, type DocumentKind } from "../src/queries/documents";
import { useAuthStore } from "../src/state/authStore";

/**
 * Document verification, phase 3. Ported from
 * legacy/flutter/driver/lib/features/onboarding/document_verification_screen.dart.
 *
 * Two documents, because two are what the backend stores: `idCardPhoto` and
 * `driverLicensePhoto`, written by `/auth/upload-id` and
 * `/auth/upload-license`. The Dart original listed four tiles -- adding
 * vehicle registration and, in Ghana, the PCSRC licence -- and marked them
 * "uploaded" the moment the picker returned, without sending anything. Two
 * of its four doors led nowhere and the other two only appeared to work.
 *
 * The country-specific paperwork is real (Ghana wants a PCSRC number, which
 * registration already collects as text) but it has no column to land in, and
 * a tile that stores nothing is worse than an absent one: a driver believes
 * they have submitted what was asked and waits for a verification that will
 * never come.
 *
 * Library, not camera, unlike the delivery photo: these are documents the
 * driver already owns a picture of, and asking them to photograph a licence
 * they scanned last year is friction with no benefit -- the human reviewer is
 * what makes this trustworthy, not the capture path.
 */
export default function VerifyDocumentsScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const upload = useUploadDocument();
  const adapter = useRef(new ImageAdapter()).current;
  const [busy, setBusy] = useState<DocumentKind | null>(null);

  const pick = (kind: DocumentKind) => {
    setBusy(kind);
    void (async () => {
      try {
        const picked = await adapter.pickFromLibrary();
        if (picked === null) return;
        const compressed = await adapter.compress(picked.uri, { maxWidth: 1600 });
        upload.mutate({ kind, uri: compressed.uri });
      } finally {
        setBusy(null);
      }
    })();
  };

  const error =
    upload.error === null || upload.error === undefined
      ? null
      : toApiFailure(upload.error).message;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="verify-documents-screen"
    >
      <Text style={typography.screenTitle} testID="verify-documents-screen-title">
        {t("driverVerifyDocuments")}
      </Text>
      <Text style={typography.caption}>{t("driverUploadDocsHint")}</Text>

      {user?.isVerified === true ? (
        <StatusPill label={t("profileVerified")} tone="success" testID="verify-documents-status" />
      ) : (
        <Text style={typography.caption} testID="verify-documents-pending">
          {t("docPending")}
        </Text>
      )}

      <DocumentTile
        label={t("docIdCard")}
        uploaded={user?.idCardPhoto != null}
        busy={busy === "id" || (upload.isPending && upload.variables?.kind === "id")}
        onPress={() => pick("id")}
        testID="verify-documents-id"
      />
      <DocumentTile
        label={t("docLicense")}
        uploaded={user?.driverLicensePhoto != null}
        busy={busy === "license" || (upload.isPending && upload.variables?.kind === "license")}
        onPress={() => pick("license")}
        testID="verify-documents-license"
      />

      {error !== null && (
        <Text style={styles.error} testID="verify-documents-error">
          {error}
        </Text>
      )}
    </ScrollView>
  );
}

function DocumentTile({
  label,
  uploaded,
  busy,
  onPress,
  testID,
}: {
  label: string;
  uploaded: boolean;
  busy: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <KayaCard testID={testID}>
      <View style={styles.tile}>
        <View style={styles.tileText}>
          <Text style={typography.bodyStrong}>{label}</Text>
          {uploaded && (
            <View style={styles.uploadedRow}>
              <Check size={14} color={colors.success} />
              <Text style={[typography.caption, styles.uploaded]}>{t("docUploaded")}</Text>
            </View>
          )}
        </View>
        <KayaButton
          label={t("actionUpload")}
          variant="secondary"
          onPress={onPress}
          loading={busy}
          icon={(color) => <Upload size={16} color={color} />}
          expand={false}
          testID={`${testID}-button`}
        />
      </View>
    </KayaCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.md },
  tile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  tileText: { flex: 1, gap: spacing.xs },
  uploadedRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  uploaded: { color: colors.success },
  error: { ...typography.caption, color: colors.danger },
});
