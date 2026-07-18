import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import axios from 'axios';

const LOCAL_UNIVERSITIES = [
  { name: 'Trường Đại học FPT TP.HCM', short: 'FPT TP.HCM', aliases: ['FPT', 'FPT University', 'FU', 'FU HCMC'] },
  { name: 'Trường Đại học Công nghệ thông tin - ĐHQG TP.HCM', short: 'UIT', aliases: ['UIT', 'CNTT', 'Cong nghe thong tin'] },
  { name: 'Trường Đại học Bách Khoa - ĐHQG TP.HCM', short: 'HCMUT', aliases: ['HCMUT', 'Bach Khoa HCM', 'BK TP.HCM', 'Bach Khoa'] },
  { name: 'Trường Đại học Khoa học tự nhiên - ĐHQG TP.HCM', short: 'HCMUS', aliases: ['HCMUS', 'KHTN', 'Khoa hoc tu nhien'] },
  { name: 'Trường Đại học Sư phạm Kỹ thuật TP.HCM', short: 'HCMUTE', aliases: ['HCMUTE', 'SPKT', 'Su pham Ky thuat'] },
  { name: 'Học viện Công nghệ Bưu chính Viễn thông - Cơ sở TP.HCM', short: 'PTIT TP.HCM', aliases: ['PTIT', 'PTIT HCM', 'Buu chinh vien thong'] },
  { name: 'Đại học Greenwich Việt Nam (Cơ sở TP.HCM)', short: 'Greenwich TP.HCM', aliases: ['Greenwich', 'GW', 'Greenwich VN'] },
  { name: 'Đại học Swinburne Việt Nam (Cơ sở TP.HCM)', short: 'Swinburne TP.HCM', aliases: ['Swinburne', 'SUT', 'Swinburne VN'] },
  { name: 'Trường Đại học Công nghệ TP.HCM', short: 'HUTECH', aliases: ['HUTECH', 'DKC', 'Cong nghe TPHCM'] },
  { name: 'Trường Đại học Tôn Đức Thắng', short: 'TDTU', aliases: ['TDTU', 'TDT', 'Ton Duc Thang'] },
  { name: 'Trường Đại học Ngoại thương - Cơ sở 2 TP.HCM', short: 'FTU2', aliases: ['FTU', 'Ngoai thuong CS2'] },
  { name: 'Trường Đại học Văn Lang', short: 'VLU', aliases: ['VLU', 'Van Lang'] },
  { name: 'Trường Đại học Hoa Sen', short: 'HSU', aliases: ['HSU', 'Hoa Sen'] },
  { name: 'Trường Đại học Sài Gòn', short: 'SGU', aliases: ['SGU', 'Sai Gon'] },
  { name: 'Trường Đại học Công nghiệp TP.HCM', short: 'IUH', aliases: ['IUH', 'Cong nghiep TPHCM', 'Cong nghiep'] },
  { name: 'Trường Đại học Mở TP.HCM', short: 'OU', aliases: ['OU', 'Mo TPHCM', 'Dai hoc Mo'] },
  { name: 'Trường Đại học Ngoại ngữ - Tin học TP.HCM', short: 'HUFLIT', aliases: ['HUFLIT', 'Ngoai ngu Tin hoc'] },
  { name: 'Trường Đại học Quốc tế - ĐHQG TP.HCM', short: 'IU', aliases: ['IU', 'Quoc te', 'International University'] },
  { name: 'Trường Đại học Kinh tế - Luật - ĐHQG TP.HCM', short: 'UEL', aliases: ['UEL', 'Kinh te Luat'] },
  { name: 'Trường Đại học Tài chính - Marketing', short: 'UFM', aliases: ['UFM', 'Tai chinh Marketing'] },
  { name: 'Trường Đại học RMIT Việt Nam (Cơ sở Nam Sài Gòn)', short: 'RMIT TP.HCM', aliases: ['RMIT', 'Dai hoc RMIT'] }
];

const removeAccents = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};



export default function UniversityCombobox({
  value,
  onChange,
  placeholder = 'Nhập hoặc chọn tên trường...',
  disabled = false,
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [universities, setUniversities] = useState(LOCAL_UNIVERSITIES);
  const [loading, setLoading] = useState(false);

  // Sync external value -> internal input (displays short name for brevity if matched)
  useEffect(() => {
    const matched = LOCAL_UNIVERSITIES.find(u => u.name === value || u.short === value);
    if (matched) {
      setInputValue(matched.short);
    } else {
      setInputValue(value || '');
    }
  }, [value]);

  useEffect(() => {
    setUniversities(LOCAL_UNIVERSITIES);
  }, []);

  const ensureApiLoaded = () => {
    // API loading disabled to prevent pollution outside regional scope
  };

  const query = removeAccents(inputValue.trim()).toLowerCase();

  const filtered = query
    ? universities.filter(u => {
        const nameMatch = removeAccents(u.name).toLowerCase().includes(query);
        const shortMatch = removeAccents(u.short).toLowerCase().includes(query);
        const aliasMatch = u.aliases.some(alias =>
          removeAccents(alias).toLowerCase().includes(query)
        );
        return nameMatch || shortMatch || aliasMatch;
      })
    : universities;

  const handleSelect = (univ) => {
    // Save/fill with the short name (e.g. FPT TP.HCM) for visual display
    // but pass the full name (e.g. Trường Đại học FPT TP.HCM) to parent state/database
    setInputValue(univ.short);
    onChange(univ.name);
    setIsOpen(false);
  };

  const isCustomInput = inputValue.trim() && !universities.some(
    u => u.name.toLowerCase() === inputValue.trim().toLowerCase() ||
         u.short.toLowerCase() === inputValue.trim().toLowerCase()
  );



  return (
    <View style={[styles.container, isOpen && { height: 240, marginBottom: -180, zIndex: 100 }]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, disabled && styles.disabledInput]}
          placeholder={placeholder}
          placeholderTextColor="#849495"
          value={inputValue}
          onChangeText={(text) => {
            setInputValue(text);
            onChange(text);
            setIsOpen(true);
            ensureApiLoaded();
          }}
          onFocus={() => {
            setIsOpen(true);
            ensureApiLoaded();
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
          editable={!disabled}
        />
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color="#00f0ff" />
          </View>
        )}
      </View>

      {isOpen && (
        <View style={styles.dropdown}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            style={styles.list}
            bounces={false}
            overScrollMode="never"
          >
            {filtered.length > 0 ? (
              filtered.map((item) => {
                const isSelected = item.short === value || item.name === value;
                return (
                  <TouchableOpacity
                    key={item.name}
                    style={[styles.item, isSelected && styles.itemSelected]}
                    onPress={() => handleSelect(item)}
                  >
                    <Text style={[styles.itemShort, isSelected && styles.itemTextSelected]}>
                      {item.short}
                    </Text>
                    {item.short !== item.name && (
                      <Text style={[styles.itemName, isSelected && styles.itemTextSelectedSub]}>
                        {item.name}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyText}>Không tìm thấy trường này</Text>
            )}
          </ScrollView>
          {isCustomInput && (
            <View style={styles.customBox}>
              <Text style={styles.customText}>
                ✎ Sẽ lưu tên tự nhập: {inputValue.trim()}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 40,
    marginBottom: 16,
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: '#3b494b',
    color: '#dae3f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderRadius: 4,
  },
  inputTrigger: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: '#3b494b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 4,
    justifyContent: 'center',
  },
  triggerText: {
    color: '#dae3f0',
    fontSize: 14,
  },
  placeholderText: {
    color: '#849495',
  },
  disabledInput: {
    opacity: 0.5,
  },
  loader: {
    position: 'absolute',
    right: 12,
  },
  dropdown: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    backgroundColor: '#131d25',
    borderColor: '#3b494b',
    borderWidth: 1,
    borderRadius: 4,
    maxHeight: 200,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  list: {
    padding: 4,
    maxHeight: 190,
  },
  item: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemSelected: {
    backgroundColor: '#00f0ff',
  },
  itemShort: {
    color: '#dae3f0',
    fontSize: 13,
    fontWeight: '800',
  },
  itemName: {
    color: '#849495',
    fontSize: 10,
    marginTop: 2,
  },
  itemTextSelected: {
    color: '#000',
  },
  itemTextSelectedSub: {
    color: 'rgba(0, 0, 0, 0.7)',
  },
  emptyText: {
    color: '#849495',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  customBox: {
    borderTopWidth: 1,
    borderTopColor: '#3b494b',
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  customText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '600',
  },
});
