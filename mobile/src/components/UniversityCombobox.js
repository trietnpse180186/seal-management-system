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
  { name: 'Trường Đại học FPT', short: 'FPT', aliases: ['FPT', 'FPT University', 'FU'] },
  { name: 'Đại học Bách Khoa Hà Nội', short: 'HUST', aliases: ['HUST', 'Bach Khoa Ha Noi', 'BKA', 'Bach Khoa'] },
  { name: 'Đại học Bách Khoa TP.HCM', short: 'HCMUT', aliases: ['HCMUT', 'Bach Khoa HCM', 'BK TP.HCM', 'Bach Khoa'] },
  { name: 'Trường Đại học Công nghệ thông tin - ĐHQG TP.HCM', short: 'UIT', aliases: ['UIT', 'CNTT', 'Cong nghe thong tin'] },
  { name: 'Trường Đại học Khoa học tự nhiên - ĐHQG TP.HCM', short: 'HCMUS', aliases: ['HCMUS', 'KHTN', 'Khoa hoc tu nhien'] },
  { name: 'Trường Đại học Công nghệ - ĐHQG Hà Nội', short: 'UET', aliases: ['UET', 'UET HNU', 'Cong nghe HN'] },
  { name: 'Trường Đại học Sư phạm Kỹ thuật TP.HCM', short: 'HCMUTE', aliases: ['HCMUTE', 'SPKT', 'Su pham Ky thuat'] },
  { name: 'Học viện Công nghệ Bưu chính Viễn thông', short: 'PTIT', aliases: ['PTIT', 'Buu chinh vien thong', 'Học viện Bưu chính'] },
  { name: 'Đại học Greenwich Việt Nam', short: 'Greenwich', aliases: ['Greenwich', 'GW', 'Greenwich VN'] },
  { name: 'Đại học Swinburne Việt Nam', short: 'Swinburne', aliases: ['Swinburne', 'SUT', 'Swinburne VN'] },
  { name: 'Trường Đại học Ngoại thương', short: 'FTU', aliases: ['FTU', 'Ngoai thuong'] },
  { name: 'Trường Đại học Kinh tế Quốc dân', short: 'NEU', aliases: ['NEU', 'Kinh te quoc dan'] },
  { name: 'Trường Đại học Công nghệ TP.HCM', short: 'HUTECH', aliases: ['HUTECH', 'DKC', 'Cong nghe TPHCM'] },
  { name: 'Trường Đại học Kinh tế TP.HCM', short: 'UEH', aliases: ['UEH', 'Kinh te TPHCM'] },
  { name: 'Trường Đại học Tôn Đức Thắng', short: 'TDTU', aliases: ['TDTU', 'TDT', 'Ton Duc Thang'] },
  { name: 'Trường Đại học RMIT Việt Nam', short: 'RMIT', aliases: ['RMIT', 'Dai hoc RMIT'] },
  { name: 'Trường Đại học Việt Đức', short: 'VGU', aliases: ['VGU', 'Viet Duc'] },
  { name: 'Đại học Quốc gia Hà Nội', short: 'VNU', aliases: ['VNU', 'ĐHQGHN'] },
  { name: 'Đại học Quốc gia TP.HCM', short: 'VNU-HCM', aliases: ['VNU-HCM', 'ĐHQGTPHCM'] },
  { name: 'Trường Đại học Khoa học và Công nghệ Hà Nội', short: 'USTH', aliases: ['USTH', 'Viet Phap', 'Vietnam France'] },
  { name: 'Học viện Kỹ thuật Mật mã', short: 'KMA', aliases: ['KMA', 'Mat ma', 'Ky thuat Mat ma'] },
  { name: 'Trường Đại học Thủy lợi', short: 'TLU', aliases: ['TLU', 'Thuy loi'] },
  { name: 'Trường Đại học Xây dựng Hà Nội', short: 'NUCE', aliases: ['NUCE', 'Xay dung', 'HUCE'] },
  { name: 'Trường Đại học Giao thông Vận tải', short: 'UTC', aliases: ['UTC', 'Giao thong van tai'] },
  { name: 'Học viện Hàng không Việt Nam', short: 'VAA', aliases: ['VAA', 'Hang khong'] },
  { name: 'Trường Đại học Công nghiệp TP.HCM', short: 'IUH', aliases: ['IUH', 'Cong nghiep TPHCM', 'Cong nghiep'] },
  { name: 'Trường Đại học Công nghiệp Hà Nội', short: 'HaUI', aliases: ['HaUI', 'Ha UI', 'HaUI'] },
  { name: 'Trường Đại học Cần Thơ', short: 'CTU', aliases: ['CTU', 'Can Tho'] },
  { name: 'Trường Đại học Duy Tân', short: 'DTU', aliases: ['DTU', 'Duy Tan'] },
  { name: 'Trường Đại học Văn Lang', short: 'VLU', aliases: ['VLU', 'Van Lang'] },
  { name: 'Trường Đại học Hoa Sen', short: 'HSU', aliases: ['HSU', 'Hoa Sen'] },
  { name: 'Trường Đại học Mở TP.HCM', short: 'OU', aliases: ['OU', 'Mo TPHCM', 'Dai hoc Mo'] },
  { name: 'Trường Đại học Ngoại ngữ - Tin học TP.HCM', short: 'HUFLIT', aliases: ['HUFLIT', 'Ngoai ngu Tin hoc'] },
  { name: 'Trường Đại học Quốc tế - ĐHQG TP.HCM', short: 'IU', aliases: ['IU', 'Quoc te', 'International University'] },
  { name: 'Trường Đại học Kinh tế - Luật - ĐHQG TP.HCM', short: 'UEL', aliases: ['UEL', 'Kinh te Luat'] },
  { name: 'Trường Đại học Khoa học Xã hội và Nhân văn - ĐHQG TP.HCM', short: 'USSH', aliases: ['USSH', 'Nhan van'] },
  { name: 'Trường Đại học Tài chính - Marketing', short: 'UFM', aliases: ['UFM', 'Tai chinh Marketing'] },
  { name: 'Trường Đại học Sài Gòn', short: 'SGU', aliases: ['SGU', 'Sai Gon'] },
  { name: 'Trường Đại học Sư phạm TP.HCM', short: 'HCMUE', aliases: ['HCMUE', 'Su pham TPHCM'] },
  { name: 'Học viện Ngân hàng', short: 'BA', aliases: ['BA', 'Ngan hang'] },
  { name: 'Trường Đại học Luật Hà Nội', short: 'HLU', aliases: ['HLU', 'Luat Ha Noi'] },
  { name: 'Trường Đại học Luật TP.HCM', short: 'ULS', aliases: ['ULS', 'Luat TPHCM'] },
  { name: 'Trường Đại học Y Hà Nội', short: 'HMU', aliases: ['HMU', 'Y Ha Noi'] },
  { name: 'Trường Đại học Y Dược TP.HCM', short: 'UMP', aliases: ['UMP', 'Y Duoc TPHCM'] },
  { name: 'Trường Đại học Phenikaa', short: 'PKA', aliases: ['PKA', 'Phenikaa'] },
  { name: 'Trường Đại học VinUniversity', short: 'VinUni', aliases: ['VinUni', 'VinUniversity'] },
  { name: 'Trường Đại học Fulbright Việt Nam', short: 'FUV', aliases: ['FUV', 'Fulbright'] },
];

const removeAccents = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

let apiCachedUniversities = null;
let isFetchingAll = false;
let fetchListeners = [];

const triggerFetch = async (onComplete) => {
  if (apiCachedUniversities) {
    if (onComplete) onComplete(apiCachedUniversities);
    return;
  }

  if (onComplete) {
    fetchListeners.push(onComplete);
  }

  if (isFetchingAll) return;
  isFetchingAll = true;

  try {
    const [res1, res2] = await Promise.all([
      axios.get('https://universities.hipolabs.com/search?country=vietnam', { timeout: 8000 }),
      axios.get('https://universities.hipolabs.com/search?country=Viet%20Nam', { timeout: 8000 })
    ]);

    const rawList = [
      ...(Array.isArray(res1.data) ? res1.data : []),
      ...(Array.isArray(res2.data) ? res2.data : [])
    ];

    if (rawList.length > 0) {
      const apiList = rawList.map((item) => ({
        name: item.name,
        short: item.name,
        aliases: item.domains || [],
      }));

      const merged = [...LOCAL_UNIVERSITIES];
      apiList.forEach((apiItem) => {
        const normalizedApiName = removeAccents(apiItem.name).toLowerCase();
        const exists = merged.some((localItem) => {
          const normalizedLocalName = removeAccents(localItem.name).toLowerCase();
          return normalizedLocalName === normalizedApiName ||
                 localItem.aliases.some(alias => removeAccents(alias).toLowerCase() === normalizedApiName);
        });

        if (!exists) {
          merged.push(apiItem);
        }
      });

      apiCachedUniversities = merged;
      fetchListeners.forEach(listener => listener(merged));
    } else {
      fetchListeners.forEach(listener => listener(LOCAL_UNIVERSITIES));
    }
  } catch (err) {
    console.warn('Could not fetch external universities, falling back to local dataset.', err);
    fetchListeners.forEach(listener => listener(LOCAL_UNIVERSITIES));
  } finally {
    isFetchingAll = false;
    fetchListeners = [];
  }
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



  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    if (apiCachedUniversities) {
      setUniversities(apiCachedUniversities);
    }
  }, []);

  const ensureApiLoaded = () => {
    if (!apiCachedUniversities) {
      setLoading(true);
      triggerFetch((data) => {
        setUniversities(data);
        setLoading(false);
      });
    }
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
    setInputValue(univ.short);
    onChange(univ.short);
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
