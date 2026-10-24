// Editorial fixtures for the public Journal. Local preview can mark them as drafts;
// production renders the same stories without writing them into the CMS API.
const lab = (name) => `/media/lab/${name}.jpg`;
const p = (en, vi) => ({ en, vi });
const paragraph = (en, vi) => ({ type: 'paragraph', copy: p(en, vi) });
const heading = (en, vi) => ({ type: 'heading', copy: p(en, vi) });
const image = (src, en, vi) => ({ type: 'image', src, captionCopy: p(en, vi), altCopy: p(en, vi) });
const credits = p('Archive image / layout study', 'Ảnh tư liệu / bản dựng biên tập');

const stories = [
  { slug: 'between-light-and-shade', category: 'stories', featured: true, image: lab('blog-colonnade'),
    title: p('Between light and shade.', 'Giữa ánh sáng và bóng râm.'),
    excerpt: p('An exercise in looking closer. Following the quiet rhythm of a place, one frame at a time.', 'Một bài tập quan sát. Theo nhịp điệu lặng lẽ của một nơi chốn, từng khung hình một.'),
    tags: ['Photo essay', 'Light', 'Composition'], blocks: [
      paragraph('A photograph does not need a spectacular subject to hold our attention. Sometimes a repeated line, a patch of reflected light, or a pause between two shapes is enough. This sequence is an editorial study in noticing those small relationships.', 'Một bức ảnh không nhất thiết cần chủ thể ngoạn mục. Đôi khi chỉ một đường nét lặp lại, một mảng sáng phản chiếu, hay khoảng nghỉ giữa hai hình khối đã đủ. Bộ ảnh này là một bản dựng biên tập về những liên hệ nhỏ ấy.'),
      heading('Let the light set the pace', 'Để ánh sáng dẫn nhịp'),
      paragraph('Before raising the camera, watch where the brightest and darkest areas meet. Move a little to either side. The subject may stay exactly where it is, while the relationship between the shapes changes completely.', 'Trước khi đưa máy lên, hãy nhìn nơi vùng sáng và vùng tối gặp nhau. Dịch sang mỗi bên một chút. Chủ thể có thể vẫn ở nguyên đó, trong khi liên hệ giữa các hình khối đã thay đổi hoàn toàn.'),
      image(lab('blog-colonnade'), 'A rhythm of columns, shadow and open space.', 'Nhịp điệu của những hàng cột, bóng đổ và khoảng trống.'),
      heading('Leave room for a quieter frame', 'Chừa chỗ cho một khung hình yên tĩnh'),
      paragraph('Not every photograph in a sequence has to carry the same weight. A quieter image gives the eye somewhere to rest. Place it beside a more detailed frame and notice how the pair changes your reading of both.', 'Không phải ảnh nào trong một bộ cũng cần có cùng sức nặng. Một bức ảnh yên tĩnh cho mắt một nơi để nghỉ. Đặt nó cạnh một khung hình nhiều chi tiết, rồi nhìn xem cách đọc cả hai đã thay đổi ra sao.'),
      { type: 'gallery', images: [image(lab('blog-church'), 'An opening in the sequence.', 'Một khoảng mở trong bộ ảnh.'), image(lab('blog-mountain'), 'A wider view, and a slower ending.', 'Một góc nhìn rộng hơn, một đoạn kết chậm hơn.')] },
      heading('Editing is part of the photograph', 'Biên tập cũng là một phần của việc chụp'),
      paragraph('Try making a sequence with only three photographs. Remove the one that repeats what another image already says. Look for an opening, a change in rhythm, and an ending that leaves a little space for the viewer.', 'Thử dựng một chuỗi chỉ với ba bức ảnh. Bỏ bức nào chỉ nhắc lại điều ảnh khác đã nói. Tìm một mở đầu, một chuyển nhịp, và một đoạn kết chừa lại khoảng trống cho người xem.'),
    ] },
  { slug: 'before-the-first-screw', category: 'repair', image: '/media/about/dang-tran-truong.png', imagePosition: '50% 65%',
    title: p('Before the first screw.', 'Trước con ốc đầu tiên.'),
    excerpt: p('Good repair starts with observation, a clear history, and knowing what not to touch yet.', 'Một ca sửa bắt đầu từ quan sát, lịch sử rõ ràng và việc biết điều gì chưa nên chạm tới.'),
    tags: ['Inspection', 'Care', 'Workshop'], blocks: [
      paragraph('A camera that will not fire can have more than one explanation. The first step is not to dismantle it. It is to describe the symptom accurately and establish what changed before it appeared. This is an inspection guide, not a report of a completed customer repair.', 'Một chiếc máy không nhả màn trập có thể có nhiều nguyên nhân. Bước đầu tiên không phải tháo máy, mà là mô tả đúng biểu hiện và xác định điều gì đã thay đổi trước đó. Đây là hướng dẫn tiếp nhận, không phải báo cáo một ca sửa của khách.'),
      heading('Start with the history', 'Bắt đầu từ lịch sử của máy'),
      paragraph('When did the camera last work normally? Was it stored for a long time, dropped, exposed to moisture, or used with a different battery? Notes like these help the technician choose the next check. They do not replace inspection.', 'Lần cuối máy hoạt động bình thường là khi nào? Máy có được cất lâu, bị rơi, gặp ẩm, hoặc dùng loại pin khác không? Những ghi chép này giúp kỹ thuật viên chọn bước kiểm tra tiếp theo, nhưng không thay thế việc kiểm tra trực tiếp.'),
      image('/media/about/dang-tran-truong.png', 'Dang Tran Truong at the workbench. Portrait supplied by HDTLABX.', 'Dang Tran Truong tại bàn làm việc. Ảnh do HDTLABX cung cấp.'),
      heading('Record the condition before work', 'Ghi nhận tình trạng trước khi sửa'),
      paragraph('Photograph the exterior and the accessories that accompany the camera. Record existing marks and the symptoms you can reproduce. Keep the intake description separate from the diagnosis, so an observation does not become a conclusion by accident.', 'Chụp ngoại hình và những phụ kiện đi cùng máy. Ghi lại các dấu có sẵn và những biểu hiện có thể tái hiện. Tách mô tả tiếp nhận khỏi chẩn đoán, để một quan sát không vô tình trở thành kết luận.'),
      { type: 'note', copy: p('Do not force a stuck mechanism. Flash circuitry can retain dangerous voltage even after the battery is removed; internal work belongs with a qualified technician.', 'Không cố ép một cơ cấu bị kẹt. Mạch flash có thể còn điện áp nguy hiểm ngay cả sau khi tháo pin; việc can thiệp bên trong cần kỹ thuật viên có chuyên môn.') },
      heading('Agree on the next step', 'Thống nhất bước tiếp theo'),
      paragraph('An inspection should lead to a clear explanation of the findings, the proposed work, and its limits. A final test should relate to the original symptom. Price and completion time depend on the camera, parts and actual findings, not a generic promise.', 'Việc kiểm tra cần đi đến giải thích rõ: đã thấy gì, đề xuất làm gì và giới hạn ở đâu. Bài kiểm tra cuối phải liên quan đến biểu hiện ban đầu. Chi phí và thời gian phụ thuộc chiếc máy, linh kiện và kết quả thực tế, không phải một lời hứa chung chung.'),
    ] },
  { slug: 'read-the-negative-first', category: 'photography', image: lab('scan-negatives'),
    title: p('Read the negative first.', 'Nhìn âm bản trước đã.'),
    excerpt: p('Exposure, development and scanning leave different clues. Start with the original.', 'Phơi sáng, tráng và scan để lại những dấu hiệu khác nhau. Hãy bắt đầu từ bản gốc.'),
    tags: ['Film', 'Scanning', 'Exposure'], blocks: [
      paragraph('A scan is an interpretation of a physical negative. When an image looks unusual, looking at the film itself can help separate capture and processing questions from scanning choices.', 'Bản scan là một cách diễn giải âm bản vật lý. Khi ảnh trông khác thường, nhìn lại cuộn film giúp tách câu hỏi về lúc chụp và lúc tráng khỏi các lựa chọn khi scan.'),
      heading('Compare more than one frame', 'Đừng chỉ nhìn một khung hình'),
      paragraph('Look at adjacent frames and the spaces between them. Is the change consistent through the roll or limited to a few photographs? Share the whole strip with the lab when asking a question, rather than only a cropped scan.', 'Nhìn các khung liền kề và khoảng film giữa chúng. Thay đổi có xuyên suốt cả cuộn hay chỉ ở vài tấm? Khi hỏi lab, nên gửi hình cả dải film thay vì chỉ một góc của bản scan.'),
      image(lab('scan-negatives'), 'Film is the starting point of the conversation.', 'Cuộn film là điểm bắt đầu của cuộc trao đổi.'),
      heading('Keep the original', 'Giữ lại bản gốc'),
      paragraph('Keep the negatives in suitable sleeves and avoid touching the image area. A careful rescan can revisit a scanning decision; it cannot recover detail that was never recorded on the film.', 'Giữ âm bản trong túi phù hợp và tránh chạm vùng ảnh. Scan lại cẩn thận có thể thay đổi cách diễn giải, nhưng không thể lấy lại chi tiết vốn chưa được ghi trên film.'),
    ] },
  { slug: 'a-camera-worth-keeping', category: 'repair', image: lab('repair-camera'),
    title: p('A camera worth keeping.', 'Một chiếc máy đáng giữ lại.'),
    excerpt: p('What to ask before buying, servicing or giving up on an older camera.', 'Những điều nên hỏi trước khi mua, bảo dưỡng hoặc từ bỏ một chiếc máy cũ.'),
    tags: ['Care', 'Buying used', 'Inspection'], blocks: [
      paragraph('Age alone does not tell you whether a camera is a good companion. Condition, repairability, the availability of parts and the way you want to use it matter more than a perfect-looking exterior.', 'Tuổi đời không tự nói lên một chiếc máy có phù hợp với bạn hay không. Tình trạng, khả năng sửa, linh kiện và cách bạn muốn sử dụng quan trọng hơn vẻ ngoài hoàn hảo.'),
      heading('Look beyond the cosmetic grade', 'Nhìn xa hơn điểm ngoại hình'),
      paragraph('Ask for a clear description of the functions that have actually been tested. A shutter sound is not a measurement of its timing. A bright viewfinder is not proof that the lens and film plane are aligned.', 'Hỏi rõ những chức năng nào thực sự đã được kiểm tra. Tiếng màn trập không phải phép đo tốc độ. Kính ngắm sáng không chứng minh ống kính và mặt phẳng film được căn đúng.'),
      image(lab('repair-camera'), 'Exterior condition is one part of a larger picture.', 'Ngoại hình chỉ là một phần của bức tranh lớn hơn.'),
      heading('Choose the right expectations', 'Đặt kỳ vọng phù hợp'),
      paragraph('Before approving work, ask what the repair can address and what may remain uncertain. Keep service records and test photographs with the camera. The most useful history is specific, dated and honest about its limits.', 'Trước khi đồng ý sửa, hãy hỏi việc sửa giải quyết được gì và điều gì còn chưa chắc chắn. Giữ hồ sơ bảo dưỡng và ảnh test cùng máy. Lịch sử hữu ích nhất là lịch sử cụ thể, có ngày tháng và nói rõ giới hạn.'),
    ] },
];

const additional = [
  ['the-space-between-frames', 'stories', 'The space between frames.', 'Khoảng nghỉ giữa những khung hình.', 'A small exercise in sequencing photographs.', 'Một bài tập nhỏ về sắp xếp bộ ảnh.', 'blog-church'],
  ['one-scene-two-kinds-of-light', 'photography', 'One scene, two kinds of light.', 'Một cảnh, hai kiểu ánh sáng.', 'Paying attention before changing the settings.', 'Quan sát trước khi thay đổi thông số.', 'blog-mountain'],
  ['after-a-long-time-in-storage', 'repair', 'After a long time in storage.', 'Sau một thời gian dài cất máy.', 'What to note before putting an old camera back to work.', 'Những điều cần ghi nhận trước khi dùng lại máy cũ.', 'lab-bench'],
  ['a-print-in-your-hands', 'photography', 'A print in your hands.', 'Một tấm ảnh trên tay.', 'Why scale and paper change the way we see a photograph.', 'Khi kích thước và giấy thay đổi cách ta nhìn một bức ảnh.', 'print-canon'],
  ['the-last-frame', 'stories', 'The last frame.', 'Khung hình cuối cùng.', 'Knowing when a short photographic story is finished.', 'Khi nào một câu chuyện ảnh ngắn đã trọn vẹn.', 'blog-colonnade'],
];
for (const [slug, category, en, vi, excerptEn, excerptVi, photo] of additional) stories.push({ slug, category,
  title: p(en, vi), excerpt: p(excerptEn, excerptVi), image: lab(photo), tags: [category === 'repair' ? 'Care' : 'Film'],
  blocks: [paragraph(excerptEn, excerptVi), ...stories[category === 'repair' ? 3 : category === 'stories' ? 0 : 2].blocks.slice(1)] });

export function journalPreviewPosts(lang, { draft = true } = {}) {
  const locale = lang === 'vi' ? 'vi' : 'en';
  const local = (copy) => copy?.[locale] || copy?.en || '';
  const block = (item) => ({ ...item, text: local(item.copy), caption: local(item.captionCopy), alt: local(item.altCopy),
    credit: item.src?.includes('/about/') ? '' : local(credits), images: item.images?.map(block) });
  return stories.map((story, index) => ({ ...story, id: `journal-preview-${index + 1}`, title: local(story.title),
    excerpt: local(story.excerpt), blocks: story.blocks.map(block), language: locale, draft,
    author: 'HDTLabx Journal', date: new Date(Date.UTC(2026, 9, 24 - index)).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    imageCaption: story.image.includes('/about/') ? local(p('Dang Tran Truong / HDTLABX', 'Dang Tran Truong / HDTLABX')) : local(credits) }));
}
