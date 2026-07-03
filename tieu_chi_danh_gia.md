# Rubric Đánh Giá Dự Án (RAG & Agent)

Tài liệu này hệ thống hóa các tiêu chí đánh giá giải pháp RAG và Agent, chia làm hai phần: **Tiêu chí Đánh giá Cơ bản** và **Tiêu chí Đánh giá Nâng cao (Vòng 2)**.

---

## 📊 Bảng Tổng Quan Tiêu Chí

### 1. Tiêu chí Đánh giá Cơ bản (Tổng trọng số: 100%)

| STT | Tiêu chí | Trọng số | Mô tả chung |
| :---: | :--- | :---: | :--- |
| 1 | Tính chính xác và Sự phù hợp với Domain | 20% | Độ bám sát chủ đề chuyên ngành được bốc thăm. |
| 2 | Xử lý & Chuẩn bị Dữ liệu | 20% | Quy trình ETL: thu thập, làm sạch, chunking và metadata. |
| 3 | Chất lượng Retrieval (Tìm kiếm & Truy xuất) | 20% | Khả năng tìm kiếm ngữ cảnh chính xác (Hybrid search, Semantic search). |
| 4 | Xử lý Intent & Prompting | 20% | Phân tích câu hỏi phức tạp và kiểm soát hallucination. |
| 5 | Slide ý tưởng và Thuyết trình | 20% | Kỹ năng truyền tải, giải thích kiến trúc và giải pháp dữ liệu. |

### 2. Tiêu chí Đánh giá Nâng cao Vòng 2 (Tổng trọng số: 100%)

| Mã | Tiêu chí | Trọng số | Mô tả chung |
| :---: | :--- | :---: | :--- |
| **R2_01** | Tư duy Agent & Xử lý Multi-hop | 25% | Tự phân rã câu hỏi, Multiple Queries, Self-reflection. |
| **R2_02** | Quản lý về tài nguyên sử dụng cho Model | 25% | Đếm token, tối ưu hóa bộ nhớ context, lưu log chi phí. |
| **R2_03** | Tính thực tế & Tối ưu vận hành | 15% | UX hiển thị nguồn (sources), tốc độ phản hồi, cập nhật data, bảo mật. |
| **R2_04** | Khả năng mở rộng & Sáng tạo | 15% | Ý tưởng đột phá (GraphRAG, Multi-agent) và phương án scale tài liệu. |
| **R2_05** | Phản biện với Hội đồng | 20% | Khả năng trả lời câu hỏi chuyên sâu, làm rõ các đánh đổi công nghệ (trade-offs). |

---

## 🔍 Chi Tiết Tiêu Chí Đánh Giá Cơ Bản

### 1. Tính chính xác và Sự phù hợp với Domain (Trọng số: 20%)

| Mức độ | Điểm | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Xuất sắc** | 5 | Giải pháp hoàn toàn bám sát chủ đề được bốc thăm. Dữ liệu, câu hỏi demo, và output đều thuộc đúng lĩnh vực chuyên ngành. |
| **Tốt** | 4 | Bám sát chủ đề, nhưng một vài phần demo hoặc dữ liệu hơi lệch sang lĩnh vực khác. |
| **Khá** | 3 | Phần lớn đúng chủ đề nhưng còn dùng dữ liệu generic, chưa thể hiện rõ tính chuyên ngành. |
| **Trung bình** | 2 | Giải pháp chỉ đúng chủ đề ở bề ngoài; nội dung thực tế chung chung, không có giá trị domain. |
| **Kém** | 1 | Giải pháp không liên quan đến chủ đề được phân công. |

### 2. Xử lý & Chuẩn bị Dữ liệu (Trọng số: 20%)

| Mức độ | Điểm | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Xuất sắc** | 5 | Pipeline rõ ràng: thu thập $\rightarrow$ làm sạch $\rightarrow$ chunking thông minh $\rightarrow$ metadata đầy đủ. Xử lý được file phức tạp (PDF, bảng, hình ảnh). |
| **Tốt** | 4 | Có pipeline xử lý, chunking hợp lý nhưng thiếu 1–2 bước tối ưu (vd: metadata chưa đầy đủ). |
| **Khá** | 3 | Xử lý dữ liệu cơ bản, chunking đơn giản (split theo ký tự/câu), chưa có tiền xử lý nâng cao. |
| **Trung bình** | 2 | Dữ liệu ít được xử lý; chunking thô, ảnh hưởng rõ đến chất lượng retrieval. |
| **Kém** | 1 | Không có pipeline xử lý dữ liệu. Đưa dữ liệu thô trực tiếp vào vector store. |

### 3. Chất lượng Retrieval (Tìm kiếm & Truy xuất) (Trọng số: 20%)

| Mức độ | Điểm | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Xuất sắc** | 5 | Hybrid search (keyword + semantic) - Không bỏ sót ngữ cảnh kĩ thuật. |
| **Tốt** | 4 | Semantic search tốt, ít bỏ sót. Chưa có hybrid hoặc reranking nhưng kết quả ổn định. |
| **Khá** | 3 | Retrieval cơ bản, đúng với câu hỏi trực tiếp. Hay bỏ sót khi câu hỏi gián tiếp hoặc dùng từ đồng nghĩa. |
| **Trung bình** | 2 | Retrieval không ổn định; thường kéo sai đoạn hoặc bỏ sót thông tin quan trọng. |
| **Kém** | 1 | Retrieval hầu như không hoạt động đúng. Kết quả trả về không liên quan. |

### 4. Xử lý Intent & Prompting (Trọng số: 20%)

| Mức độ | Điểm | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Xuất sắc** | 5 | Phân tích đúng intent kể cả câu hỏi mơ hồ/phức tạp. Tự phân rã câu hỏi multi-hop. Prompt engineering ngăn hallucination hiệu quả. |
| **Tốt** | 4 | Xử lý đúng hầu hết intent. Prompt ổn, đôi khi chưa xử lý được câu hỏi mơ hồ hoặc nhiều lớp. |
| **Khá** | 3 | Chỉ xử lý được intent đơn giản, câu hỏi thẳng. Prompt chưa tối ưu, đôi khi trả lời lan man. |
| **Trung bình** | 2 | Hay hiểu sai intent. Prompt không kiểm soát được output; câu trả lời lạc đề. |
| **Kém** | 1 | Không có cơ chế xử lý intent. Hệ thống hoạt động tuyến tính, không phân tích câu hỏi. |

### 5. Slide ý tưởng và Thuyết trình (Trọng số: 20%)

| Mức độ | Điểm | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Xuất sắc** | 5 | Thuyết trình rất thuyết phục, đầy đủ và rõ ràng, giải thích chi tiết từng bước xử lý dữ liệu, lý do lựa chọn các nguồn dữ liệu và phương pháp kiểm tra. |
| **Tốt** | 4 | Thuyết trình rõ ràng nhưng thiếu một số chi tiết hoặc giải thích về các bước xử lý dữ liệu. |
| **Khá** | 3 | Trình bày ở mức cơ bản, thiếu một số giải thích về các nguồn dữ liệu hoặc quá trình kiểm tra. |
| **Trung bình** | 2 | Giao diện không dễ sử dụng, thiếu tính tương tác, không cung cấp phản hồi hợp lý. *(Lưu ý: Nội dung gốc ghi nhận lỗi về giao diện tại mục này)* |
| **Kém** | 1 | Trình bày thiếu rõ ràng, không giải thích đầy đủ về cách thức xử lý dữ liệu. |

---

## 🚀 Chi Tiết Tiêu Chí Đánh Giá Nâng Cao Vòng 2

### R2_01: Tư duy Agent & Xử lý Multi-hop (Trọng số: 25%)

| Mức độ | Điểm | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Xuất sắc** | 5 | - Tự phân rã câu hỏi phức tạp thành sub-queries.<br>- **Multiple Queries**: Sinh nhiều biến thể câu hỏi để tăng recall.<br>- **Self-reflection**: Tự kiểm tra câu trả lời trước khi trả về.<br>- Biết hỏi lại user khi intent mơ hồ thay vì đoán. |
| **Tốt** | 4 | - Xử lý được câu hỏi cần tổng hợp từ 2–3 nguồn.<br>- Workflow logic và rõ ràng. Chưa có self-reflection hoặc multiple queries.<br>- Có trích dẫn nhưng đôi khi trích dẫn hơi rộng (cả đoạn dài) thay vì đúng câu chứa ý chính. |
| **Khá** | 3 | - Chỉ xử lý được câu hỏi đơn lớp.<br>- Chưa có tư duy phân rã hay lập kế hoạch. |
| **Trung bình** | 2 | Hệ thống tuyến tính đơn giản. Câu hỏi phức tạp thường trả lời thiếu hoặc sai. |
| **Kém** | 1 | Không có tư duy Agent. Chỉ là retrieve $\rightarrow$ generate đơn thuần. |

### R2_02: Quản lý về tài nguyên sử dụng cho Model (Trọng số: 25%)

| Mức độ | Điểm | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Xuất sắc** | 5 | - **Smart Truncation/Summary**: Hệ thống tự động phát hiện khi sắp tràn bộ nhớ (Context Window) và thực hiện cắt tỉa tin nhắn cũ hoặc tóm tắt lại lịch sử mà không cần User can thiệp.<br>- **Hậu kiểm chuyên nghiệp**: Lưu log tự động vào file (CSV/JSONL) gồm: Timestamp, Team, Model, Input_Tokens, Output_Tokens, Cost (ước tính). |
| **Tốt** | 4 | - **Threshold Awareness**: Có thông báo cảnh báo (vd: màu đỏ hoặc text) khi lượng token đạt mức 80% giới hạn của model.<br>- **Minh bạch**: Tách biệt rõ ràng lượng token tiêu tốn cho: Hệ thống (System), Người dùng (User) và Phản hồi (Assistant). |
| **Khá** | 3 | - **Đúng công cụ**: Sử dụng chuẩn `tiktoken` (OpenAI) hoặc `AutoTokenizer` (HuggingFace).<br>- **Thời gian thực**: Hiển thị số token tiêu thụ ngay lập tức sau mỗi lần Model trả lời.<br>- **Chính xác**: Kết quả đếm khớp với đơn vị Tokenizer của model, không phải đếm số từ/ký tự thô. |
| **Trung bình** | 2 | - **Ước lượng thô**: Dùng các hàm thủ công như `len(text.split())` dẫn đến sai số (thường thấp hơn thực tế 20-30%).<br>- **Hậu kiểm rời rạc**: Phải mở trang web của bên thứ ba (OpenAI Dashboard) mới biết lượng tài nguyên đã dùng, không tích hợp vào luồng xử lý. |
| **Kém** | 1 | - **Hệ thống mù (Blind System)**: Không có bộ đếm. Thí sinh hoàn toàn không biết mình đã dùng bao nhiêu tài nguyên.<br>- **Dễ crash**: Chương trình bị ngắt quãng hoặc báo lỗi "Limit Exceeded" mà không có xử lý ngoại lệ. |

### R2_03: Tính thực tế & Tối ưu vận hành (Trọng số: 15%)

| Mức độ | Điểm | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Xuất sắc** | 5 | - Giao diện cho phép người dùng kiểm tra "nguồn gốc" câu trả lời dễ dàng.<br>- Tốc độ phản hồi nhanh.<br>- Xử lý được data update — thêm tài liệu mới mà không cần rebuild toàn bộ index.<br>- Tính Bảo mật dữ liệu (nếu dùng bên thứ 3 khả năng mất data là có khả năng). |
| **Tốt** | 4 | - Giao diện thân thiện, dễ dùng.<br>- Tốc độ ổn định nhưng chưa có cơ chế quản lý dữ liệu lỗi. |
| **Khá** | 3 | - Giao diện cơ bản, chưa tối ưu trải nghiệm người dùng (UX).<br>- Thời gian chờ đợi phản hồi còn lâu. |
| **Trung bình** | 2 | Hệ thống khó sử dụng, không có tính ứng dụng vào thực tế doanh nghiệp. |
| **Kém** | 1 | Hệ thống không dùng được trong thực tế. Lỗi thường xuyên hoặc phản hồi quá chậm. |

### R2_04: Khả năng mở rộng & Sáng tạo (Trọng số: 15%)

| Mức độ | Điểm | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Xuất sắc** | 5 | - Giải pháp có tính đột phá (ví dụ: kiến trúc đa Agents).<br>- Có phương án cụ thể để mở rộng lên hàng triệu tài liệu mà không làm giảm chất lượng (ví dụ: distributed vector DB).<br>- Có ý tưởng sáng tạo rõ ràng: vd graph RAG, multimodal RAG, adaptive chunking. |
| **Tốt** | 4 | - Có điểm nhấn sáng tạo trong cách xử lý dữ liệu hoặc giao diện.<br>- Phương án mở rộng khả thi nhưng chưa chi tiết. |
| **Khá** | 3 | Giải pháp an toàn, đi theo các khuôn mẫu có sẵn, chưa có sự đột phá. |
| **Trung bình** | 2 | Ý tưởng rập khuôn, không có sự cải tiến so với các giải pháp mẫu trên mạng. |
| **Kém** | 1 | Không có điểm sáng tạo. Không có kế hoạch mở rộng. |

### R2_05: Phản biện với Hội đồng (Trọng số: 20%)

| Mức độ | Điểm | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Xuất sắc** | 5 | - Trả lời chính xác, tự tin mọi câu hỏi kỹ thuật.<br>- Giải thích được lý do chọn từng công cụ/framework so với alternatives.<br>- Nhận ra và thừa nhận điểm yếu, đề xuất hướng cải thiện cụ thể. |
| **Tốt** | 4 | - Trả lời tốt hầu hết câu hỏi.<br>- Còn 1–2 điểm kỹ thuật chưa giải thích thuyết phục. |
| **Khá** | 3 | - Trả lời được câu hỏi cơ bản.<br>- Lúng túng với câu hỏi về trade-off hoặc lý do chọn công nghệ. |
| **Trung bình** | 2 | - Chỉ trả lời được câu hỏi mô tả sản phẩm.<br>- Không giải thích được quyết định kỹ thuật. |
| **Kém** | 1 | Không trả lời được câu hỏi từ BGK hoặc né tránh. |
