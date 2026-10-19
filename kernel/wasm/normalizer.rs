// Rust WebAssembly (WASM) Amharic Canonical Homophone Normalizer for Edge Workers
// Maintains exact linguistic vowel-order parity with services/orchestrator/fast_voice_loop.py

pub fn normalize_amharic_text(input: &str) -> String {
    let mut normalized = String::with_capacity(input.len());
    
    for ch in input.chars() {
        let mapped = match ch {
            // ሐ (Hameru Ha) -> ሀ
            'ሐ' => 'ሀ', 'ሑ' => 'ሁ', 'ሒ' => 'ሂ', 'ሓ' => 'ሃ', 'ሔ' => 'ሄ', 'ሕ' => 'ህ', 'ሖ' => 'ሆ',
            // ኀ (Buzu Ha) -> ሀ
            'ኀ' => 'ሀ', 'ኁ' => 'ሁ', 'ኂ' => 'ሂ', 'ኃ' => 'ሃ', 'ኄ' => 'ሄ', 'ኅ' => 'ህ', 'ኆ' => 'ሆ',
            // ሠ (Nigus Se) -> ሰ
            'ሠ' => 'ሰ', 'ሡ' => 'ሱ', 'ሢ' => 'ሲ', 'ሣ' => 'ሳ', 'ሤ' => 'ሴ', 'ሥ' => 'ስ', 'ሦ' => 'ሶ',
            // ዐ (Aynu A) -> አ
            'ዐ' => 'አ', 'ዑ' => 'ኡ', 'ዒ' => 'ኢ', 'ዓ' => 'ኣ', 'ዔ' => 'ኤ', 'ዕ' => 'እ', 'ዖ' => 'ኦ',
            // ጸ (Tsehay Tse) -> ፀ
            'ጸ' => 'ፀ', 'ጹ' => 'ፁ', 'ጺ' => 'ፂ', 'ጻ' => 'ፃ', 'ጼ' => 'ፄ', 'ጽ' => 'ፅ', 'ጾ' => 'ፆ',
            other => other,
        };
        normalized.push(mapped);
    }
    
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalization_preserves_vowel_orders() {
        assert_eq!(normalize_amharic_text("ሐኪም"), "ሀኪም");      // 1st order
        assert_eq!(normalize_amharic_text("ሕይወት"), "ህይወት");    // 6th order preserved
        assert_eq!(normalize_amharic_text("ሥራ"), "ስራ");        // 6th order preserved
        assert_eq!(normalize_amharic_text("ዓለም"), "ኣለም");      // 4th order preserved
        assert_eq!(normalize_amharic_text("ጸሀይ"), "ፀሀይ");      // 1st order preserved
        assert_eq!(normalize_amharic_text("ጽዋ"), "ፅዋ");        // 6th order preserved
    }
}
