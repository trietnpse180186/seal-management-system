import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import { fptLogoSvgXml } from '../../assets/fptLogoSvg';

export default function WelcomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Center Container for Branding Section */}
        <View style={styles.centerSection}>
          {/* Top Branding Section */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <SvgXml xml={fptLogoSvgXml} width={180} height={70} />
            </View>
            <Text style={styles.titleLogo}>SEAL</Text>
            <View style={styles.subLogoBox}>
              <Text style={styles.subLogoText}>HACKATHON 2026</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons Section */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>ĐĂNG NHẬP HỆ THỐNG</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>ĐĂNG KÝ TÀI KHOẢN MỚI</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  titleLogo: {
    fontSize: 52,
    fontWeight: '900',
    color: '#ea580c',
    letterSpacing: 3,
  },
  subLogoBox: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  subLogoText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  actionsSection: {
    marginTop: 20,
    marginBottom: 10,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#ea580c',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#ea580c',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  guestLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  guestLinkText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});
