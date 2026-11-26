from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'HUONG_DAN_SU_DUNG_TITSMART.docx'
IMAGE_DIR = ROOT / 'docs' / 'images' / 'product-cloud' / 'verified'

NAVY = '002B6B'
BLUE = 'EAF2FF'
GRID = 'D9E2F0'
TEXT = '1F2937'

def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:fill'), fill)
    tc_pr.append(shd)

def set_cell_border(cell, color=GRID):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    borders = tcPr.first_child_found_in('w:tcBorders')
    if borders is None:
        borders = OxmlElement('w:tcBorders')
        tcPr.append(borders)
    for edge in ('top', 'left', 'bottom', 'right'):
        tag = 'w:' + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn('w:val'), 'single')
        element.set(qn('w:sz'), '6')
        element.set(qn('w:space'), '0')
        element.set(qn('w:color'), color)

def set_cell_margins(cell, top=90, start=110, bottom=90, end=110):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    margins = tcPr.first_child_found_in('w:tcMar')
    if margins is None:
        margins = OxmlElement('w:tcMar')
        tcPr.append(margins)
    for side, value in [('top', top), ('start', start), ('bottom', bottom), ('end', end)]:
        node = margins.find(qn('w:' + side))
        if node is None:
            node = OxmlElement('w:' + side)
            margins.append(node)
        node.set(qn('w:w'), str(value))
        node.set(qn('w:type'), 'dxa')

def set_repeat_table_header(row):
    trPr = row._tr.get_or_add_trPr()
    tblHeader = OxmlElement('w:tblHeader')
    tblHeader.set(qn('w:val'), 'true')
    trPr.append(tblHeader)

def add_text(p, text, bold=False, size=None, color=TEXT):
    r = p.add_run(text)
    r.bold = bold
    r.font.name = 'Arial'
    r._element.rPr.rFonts.set(qn('w:ascii'), 'Arial')
    r._element.rPr.rFonts.set(qn('w:hAnsi'), 'Arial')
    r.font.color.rgb = RGBColor.from_string(color)
    if size:
        r.font.size = Pt(size)
    return r

def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style='List Bullet' if level == 0 else 'List Bullet 2')
    p.paragraph_format.space_after = Pt(3)
    add_text(p, text, size=10.5)
    return p

def add_step(doc, number, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.18)
    p.paragraph_format.first_line_indent = Inches(-0.18)
    p.paragraph_format.space_after = Pt(4)
    add_text(p, f'{number}. ', bold=True, color=NAVY, size=10.5)
    add_text(p, text, size=10.5)
    return p

def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = 'Table Grid'
    hdr = table.rows[0]
    set_repeat_table_header(hdr)
    for idx, value in enumerate(headers):
        cell = hdr.cells[idx]
        set_cell_shading(cell, NAVY)
        set_cell_border(cell)
        set_cell_margins(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_text(p, value, bold=True, size=9, color='FFFFFF')
        if widths:
            cell.width = Inches(widths[idx])
    for r_index, values in enumerate(rows):
        cells = table.add_row().cells
        for idx, value in enumerate(values):
            cell = cells[idx]
            if r_index % 2 == 1:
                set_cell_shading(cell, 'F7FAFC')
            set_cell_border(cell)
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            add_text(p, value, size=9.5)
            if widths:
                cell.width = Inches(widths[idx])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table

def heading(doc, title, level=1):
    p = doc.add_paragraph(style=f'Heading {level}')
    p.paragraph_format.space_before = Pt(14 if level == 1 else 9)
    p.paragraph_format.space_after = Pt(6)
    add_text(p, title, bold=True, size=15 if level == 1 else 12, color='000000')
    return p

def normal(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.15
    add_text(p, text, size=10.5)
    return p

def page_break(doc):
    doc.add_page_break()

def add_screenshot(doc, filename, caption):
    image = IMAGE_DIR / filename
    if not image.exists():
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(3)
    p.add_run().add_picture(str(image), width=Inches(6.9))
    caption_p = doc.add_paragraph()
    caption_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    caption_p.paragraph_format.space_after = Pt(8)
    add_text(caption_p, f'Hình: {caption}', size=9, color='6B7280')

doc = Document()
sec = doc.sections[0]
sec.top_margin = Inches(0.7)
sec.bottom_margin = Inches(0.7)
sec.left_margin = Inches(0.75)
sec.right_margin = Inches(0.75)

styles = doc.styles
styles['Normal'].font.name = 'Arial'
styles['Normal']._element.rPr.rFonts.set(qn('w:ascii'), 'Arial')
styles['Normal']._element.rPr.rFonts.set(qn('w:hAnsi'), 'Arial')
styles['Normal'].font.size = Pt(10.5)

# Cover
p = doc.add_paragraph(style='Title')
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(94)
p.paragraph_format.space_after = Pt(16)
add_text(p, 'HƯỚNG DẪN SỬ DỤNG TITSMART', bold=True, size=25, color='000000')
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(18)
add_text(p, 'Hệ thống quản lý công việc và dự án', size=14, color=NAVY)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_text(p, 'Phiên bản hướng dẫn sử dụng', size=10.5, color='6B7280')
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_text(p, 'TITSMART', bold=True, size=12, color=NAVY)
page_break(doc)

heading(doc, 'Mục đích tài liệu')
normal(doc, 'Tài liệu này hướng dẫn người dùng khai thác các khu vực đã hiển thị trên phiên Product Cloud của TITSMART. Nội dung ưu tiên các thao tác xem, tìm kiếm, lọc và theo dõi công việc. Quyền tạo, sửa, duyệt hoặc xóa dữ liệu phụ thuộc vào vai trò được cấp cho từng tài khoản.')
heading(doc, 'Cách sử dụng tài liệu', 2)
add_bullet(doc, 'Bắt đầu từ phần Điều hướng để nhận biết vị trí các nhóm chức năng.')
add_bullet(doc, 'Ở từng tab, sử dụng bộ lọc và tìm kiếm trước khi mở chi tiết bản ghi.')
add_bullet(doc, 'Nếu không thấy nút hoặc không thao tác được, kiểm tra quyền tài khoản thay vì tự suy luận rằng dữ liệu bị lỗi.')
add_bullet(doc, 'Các tính năng chưa xác minh đủ vai trò được ghi nhận trong phụ lục kiểm chứng.')
heading(doc, 'Danh mục nội dung', 2)
add_table(doc, ['Phần', 'Nội dung'], [
    ('1', 'Đăng nhập và điều hướng'),
    ('2', 'Tổng quan và dự án'),
    ('3', 'Công việc và kế hoạch'),
    ('4', 'Hồ sơ, kho, công và lương'),
    ('5', 'Nhân sự, tài khoản và nhật ký'),
    ('6', 'Sự cố thường gặp và checklist xác nhận'),
], [0.7, 5.8])
heading(doc, 'Danh mục tab đã xác nhận trên Product Cloud', 2)
add_table(doc, ['Nhóm', 'Tab'], [
    ('Tổng quan', 'Tổng quan'),
    ('Dự án', 'Tất cả; Đang triển khai; Hoàn thành'),
    ('Công việc', 'Tổng quan; Dự án; Phát sinh; Việc của tôi; Kế hoạch'),
    ('Hồ sơ', 'Quản lý hồ sơ'),
    ('Tổng kho', 'Tổng quan; Tồn kho; Nhập kho; Xuất kho'),
    ('Công và lương', 'Tổng quan; Chấm công; Xin nghỉ; Bù công'),
    ('Nhân sự', 'Nhân sự'),
    ('Tài khoản', 'Có khu vực cài đặt/tài khoản; chưa chụp riêng trong đợt xác nhận này.'),
], [1.45, 5.05])

page_break(doc)
heading(doc, '1 Đăng nhập và điều hướng')
heading(doc, 'Đăng nhập hệ thống', 2)
normal(doc, 'Mở TITSMART tại môi trường được đơn vị quản trị cung cấp. Nhập tên đăng nhập và mật khẩu đã được cấp, sau đó chọn Đăng nhập vào hệ thống. Không chia sẻ mật khẩu, mã xác thực hoặc ảnh có chứa thông tin đăng nhập.')
add_step(doc, 1, 'Mở ứng dụng TITSMART.')
add_step(doc, 2, 'Nhập tên đăng nhập và mật khẩu được cấp.')
add_step(doc, 3, 'Chọn Đăng nhập vào hệ thống và chờ tải trang làm việc.')
heading(doc, 'Thanh điều hướng bên trái', 2)
normal(doc, 'Thanh menu bên trái là điểm vào các nhóm nghiệp vụ. Trên tài khoản đang kiểm chứng, các nhóm chính gồm Tổng quan, Tất cả dự án, Công việc, Quản lý hồ sơ, Tổng kho, Công và lương, Nhân sự và khu vực Tài khoản ở cuối menu.')
add_table(doc, ['Nhóm', 'Mục đích sử dụng'], [
    ('Tổng quan', 'Theo dõi chỉ số và công việc cần chú ý.'),
    ('Tất cả dự án', 'Lọc, tìm kiếm và mở chi tiết từng dự án.'),
    ('Công việc', 'Theo dõi công việc dự án, phát sinh, việc của tôi và kế hoạch.'),
    ('Quản lý hồ sơ', 'Tra cứu hồ sơ nghiệp vụ và chứng từ theo quyền được cấp.'),
    ('Tổng kho', 'Theo dõi tồn kho, nhập kho và xuất kho.'),
    ('Công và lương', 'Theo dõi chấm công, nghỉ phép, bù công và dữ liệu lương theo quyền.'),
    ('Nhân sự', 'Tra cứu danh sách nhân sự và hồ sơ liên quan.'),
    ('Tài khoản', 'Xem, cập nhật thông tin cá nhân và thiết lập ứng dụng.'),
], [1.55, 4.95])

page_break(doc)
heading(doc, '2 Tổng quan và dự án')
heading(doc, 'Tổng quan', 2)
normal(doc, 'Tab Tổng quan là điểm bắt đầu để kiểm tra nhanh tình hình chung. Các chỉ số hiển thị phụ thuộc dữ liệu và quyền của tài khoản. Khi thấy chỉ số hoặc cảnh báo, mở phần liên quan để xem danh sách bản ghi chi tiết.')
add_screenshot(doc, '01-tong-quan.png', 'Trang Tổng quan trên Product Cloud')
heading(doc, 'Tất cả dự án', 2)
normal(doc, 'Danh sách dự án hiển thị các dự án theo trạng thái. Mỗi thẻ dự án thể hiện mã hoặc số thứ tự, tên dự án, mức ưu tiên, trạng thái triển khai, thông tin chủ đầu tư hoặc địa điểm khi có, nhân sự liên quan và tiến độ.')
add_step(doc, 1, 'Chọn Tất cả dự án trên thanh menu.')
add_step(doc, 2, 'Dùng bộ lọc Phân loại, Ưu tiên, khoảng ngày hoặc ô tìm kiếm để thu hẹp danh sách.')
add_step(doc, 3, 'Chọn thẻ dự án cần xem để mở khu vực chi tiết dự án.')
add_screenshot(doc, '02-du-an-tat-ca.png', 'Tab Tất cả dự án trên Product Cloud')
add_screenshot(doc, '03-du-an-dang-trien-khai.png', 'Tab Dự án đang triển khai trên Product Cloud')
add_screenshot(doc, '04-du-an-hoan-thanh.png', 'Tab Dự án hoàn thành trên Product Cloud')
heading(doc, 'Khu vực chi tiết dự án', 2)
normal(doc, 'Trong một dự án, các khu vực có thể bao gồm tổng quan, kế hoạch, tiến độ/công việc, đặt hàng, chứng từ, thanh toán, chi phí, hồ sơ, thư viện, kho và hiện trường. Danh sách hiển thị tùy theo cấu hình của dự án và quyền tài khoản.')
add_table(doc, ['Khu vực', 'Nội dung cần theo dõi'], [
    ('Tổng quan', 'Thông tin cơ bản, tiến độ và các nội dung nổi bật của dự án.'),
    ('Kế hoạch', 'Các kế hoạch và mốc cần thực hiện của dự án.'),
    ('Tiến độ', 'Công việc, người thực hiện và mức độ hoàn thành.'),
    ('Vật tư và chi phí', 'Đặt hàng, chứng từ, thanh toán và chi phí theo dự án.'),
    ('Hồ sơ, kho, hiện trường', 'Tài liệu, vật tư và nhật ký hiện trường theo phạm vi dự án.'),
], [1.7, 4.8])

page_break(doc)
heading(doc, '3 Công việc và kế hoạch')
heading(doc, 'Công việc dự án và phát sinh', 2)
normal(doc, 'Nhóm Công việc có các mục con để phân biệt việc thuộc dự án, việc phát sinh, việc của cá nhân và kế hoạch. Hãy dùng đúng mục để tránh bỏ sót đầu việc.')
add_table(doc, ['Mục', 'Cách dùng'], [
    ('Dự án', 'Xem công việc được tổ chức theo dự án; kết hợp lọc dự án, trạng thái hoặc người phụ trách.'),
    ('Phát sinh', 'Theo dõi các việc ngoài kế hoạch hoặc phát sinh cần xử lý.'),
    ('Việc của tôi', 'Xem công việc liên quan trực tiếp đến tài khoản hiện tại.'),
    ('Kế hoạch', 'Xem lịch và kế hoạch công việc theo thời gian hoặc phạm vi dự án.'),
], [1.6, 4.9])
add_screenshot(doc, '05-cong-viec-tong-quan.png', 'Tổng quan nhóm Công việc')
add_screenshot(doc, '06-cong-viec-du-an.png', 'Tab Công việc theo dự án')
add_screenshot(doc, '07-cong-viec-phat-sinh.png', 'Tab Công việc phát sinh')
add_screenshot(doc, '08-viec-cua-toi.png', 'Tab Việc của tôi')
heading(doc, 'Lịch và kế hoạch', 2)
normal(doc, 'Ở trang kế hoạch, dùng chế độ hiển thị theo thời gian, bộ lọc dự án, người phụ trách và trạng thái để xác định những việc đến hạn hoặc đang triển khai. Chỉ tạo hay điều chỉnh kế hoạch khi tài khoản có quyền và khi được giao trách nhiệm.')
add_screenshot(doc, '09-ke-hoach.png', 'Tab Kế hoạch')
heading(doc, 'Nguyên tắc theo dõi tiến độ', 2)
add_bullet(doc, 'Ưu tiên xử lý việc quá hạn hoặc gần đến hạn trước.')
add_bullet(doc, 'Mở công việc để xem người phụ trách, hạn hoàn thành và trao đổi liên quan.')
add_bullet(doc, 'Không thay đổi tiến độ của người khác nếu không có quyền được cấp.')

page_break(doc)
heading(doc, '4 Hồ sơ Kho Công và lương')
heading(doc, 'Quản lý hồ sơ', 2)
normal(doc, 'Tab Quản lý hồ sơ dùng để tra cứu các hồ sơ nghiệp vụ theo phạm vi được cấp quyền. Khi mở hồ sơ, kiểm tra dự án, loại hồ sơ, trạng thái và tệp đính kèm trước khi thực hiện bất kỳ thao tác nào.')
normal(doc, 'Phân tách Hồ sơ đầu vào và Hồ sơ đầu ra cần được xác nhận theo cấu hình Product tại thời điểm sử dụng. Hồ sơ đầu vào liên quan nghĩa vụ công ty thanh toán; hồ sơ đầu ra liên quan khoản khách hàng hoặc chủ đầu tư thanh toán cho công ty.')
add_screenshot(doc, '10-ho-so.png', 'Danh sách Quản lý hồ sơ trên Product Cloud')
heading(doc, 'Tổng kho', 2)
normal(doc, 'Nhóm Tổng kho bao gồm theo dõi tồn kho, nhập kho và xuất kho. Dùng từng mục để tra cứu số lượng, lịch sử biến động và chứng từ kho. Mọi nghiệp vụ làm thay đổi số lượng phải thực hiện bởi người được phân quyền.')
add_screenshot(doc, '11-kho-tong-quan.png', 'Tổng quan Tổng kho')
add_screenshot(doc, '12-kho-ton.png', 'Tab Tồn kho')
add_screenshot(doc, '13-kho-nhap.png', 'Tab Nhập kho')
add_screenshot(doc, '14-kho-xuat.png', 'Tab Xuất kho')
heading(doc, 'Công và lương', 2)
normal(doc, 'Nhóm Công và lương bao gồm chấm công, xin nghỉ và bù công. Tài khoản hiện tại có thể thấy dữ liệu cá nhân hoặc dữ liệu quản lý theo vai trò. Kiểm tra ngày, ca làm và trạng thái đơn trước khi gửi hoặc xác nhận bất kỳ nội dung nào.')
add_table(doc, ['Mục', 'Nội dung'], [
    ('Chấm công', 'Xem tình trạng điểm danh, ngày công và dữ liệu liên quan.'),
    ('Xin nghỉ', 'Theo dõi các đơn nghỉ và trạng thái xử lý.'),
    ('Bù công', 'Theo dõi yêu cầu điều chỉnh/bù công theo quy trình được cấp.'),
    ('Bảng lương', 'Chỉ hiển thị khi tài khoản được phép xem dữ liệu lương.'),
], [1.6, 4.9])
add_screenshot(doc, '15-cong-luong-tong-quan.png', 'Tổng quan Công và lương')
add_screenshot(doc, '16-cham-cong.png', 'Tab Chấm công')
add_screenshot(doc, '17-xin-nghi.png', 'Tab Xin nghỉ')
add_screenshot(doc, '18-bu-cong.png', 'Tab Bù công')

page_break(doc)
heading(doc, '5 Nhân sự Tài khoản và nhật ký')
heading(doc, 'Nhân sự', 2)
normal(doc, 'Tab Nhân sự hiển thị danh sách người dùng và thông tin hồ sơ theo quyền. Dùng tìm kiếm hoặc bộ lọc để tìm nhanh một nhân sự. Việc chỉnh sửa hồ sơ, phân quyền hoặc tải ảnh chỉ dành cho người có quyền phù hợp.')
add_screenshot(doc, '19-nhan-su.png', 'Danh sách Nhân sự trên Product Cloud')
heading(doc, 'Tài khoản cá nhân', 2)
normal(doc, 'Khu vực tài khoản được mở từ phần người dùng ở cuối thanh menu. Tại đây người dùng xem thông tin cơ bản, thiết lập tài khoản, cập nhật dữ liệu cá nhân và thao tác bảo mật theo các nút được hiển thị.')
add_step(doc, 1, 'Chọn khu vực tên tài khoản ở cuối thanh menu.')
add_step(doc, 2, 'Chọn trang Tài khoản hoặc mục thiết lập cần xem.')
add_step(doc, 3, 'Kiểm tra dữ liệu trước khi lưu thay đổi; chỉ lưu khi được phép cập nhật.')
heading(doc, 'Nhật ký hoạt động và thông báo', 2)
normal(doc, 'Nhật ký hoạt động hỗ trợ tra cứu các thao tác đã được hệ thống ghi nhận. Chuông thông báo ở góc trên giúp theo dõi nội dung mới. Khi có dữ liệu chưa cập nhật, tải lại trang hoặc kiểm tra kết nối trước khi thao tác lặp lại.')

page_break(doc)
heading(doc, '6 Xử lý sự cố thường gặp')
add_table(doc, ['Tình huống', 'Cách kiểm tra trước'], [
    ('Không tải được dữ liệu', 'Kiểm tra Internet, tải lại trang, sau đó đăng nhập lại nếu phiên đã hết hạn.'),
    ('Không thấy tab hoặc nút thao tác', 'Kiểm tra vai trò tài khoản và phạm vi dự án được phân công.'),
    ('Không thấy thông báo mới', 'Mở lại ứng dụng khi thiết bị vừa có mạng; kiểm tra quyền nhận thông báo của hệ điều hành.'),
    ('Dữ liệu giữa thiết bị chưa cập nhật', 'Kiểm tra cả hai thiết bị có Internet và đăng nhập cùng môi trường Product trước khi tải lại dữ liệu.'),
    ('Không thể lưu', 'Kiểm tra trường bắt buộc, quyền thao tác và thông báo lỗi hiển thị trên màn hình.'),
], [2.2, 4.3])
heading(doc, 'Nguyên tắc an toàn dữ liệu', 2)
add_bullet(doc, 'Không dùng chung tài khoản và không gửi mật khẩu qua ảnh chụp hoặc tài liệu.')
add_bullet(doc, 'Chỉ thao tác duyệt, thanh toán, chấm công hoặc xóa dữ liệu khi có thẩm quyền.')
add_bullet(doc, 'Không dùng dữ liệu local/dev làm căn cứ đối chiếu với dữ liệu Product.')

page_break(doc)
heading(doc, 'Phụ lục A Checklist xác nhận trên Product Cloud')
normal(doc, 'Checklist dưới đây phản ánh các khu vực đã quan sát được trên phiên Product Cloud bằng tài khoản vai trò Giám đốc tại thời điểm biên soạn. Các thao tác chuyên biệt của nhân viên, Quản lý dự án và Kế toán/Thủ quỹ vẫn cần được kiểm chứng bằng tài khoản tương ứng.')
add_table(doc, ['Khu vực', 'Trạng thái kiểm chứng', 'Ghi chú'], [
    ('Đăng nhập', 'Đã xác nhận', 'Có màn hình đăng nhập và vào được trang làm việc.'),
    ('Tất cả dự án', 'Đã xác nhận', 'Có thẻ dự án, tìm kiếm và bộ lọc.'),
    ('Công việc', 'Đã xác nhận menu', 'Có các mục Dự án, Phát sinh, Việc của tôi, Kế hoạch.'),
    ('Quản lý hồ sơ', 'Đã xác nhận menu', 'Cần kiểm chứng sâu theo quyền và cấu hình hồ sơ.'),
    ('Tổng kho', 'Đã xác nhận menu', 'Có các mục tồn kho, nhập kho và xuất kho.'),
    ('Công và lương', 'Đã xác nhận menu', 'Cần kiểm chứng sâu phần lương/quyền duyệt.'),
    ('Nhân sự', 'Đã xác nhận menu', 'Cần kiểm chứng sâu phần phân quyền và chỉnh sửa.'),
    ('Yêu cầu thanh toán', 'Chưa xác minh đầy đủ', 'Không mô tả luồng phê duyệt cho đến khi kiểm chứng bằng vai trò phù hợp.'),
    ('Hồ sơ đầu vào và đầu ra', 'Chưa xác minh đầy đủ', 'Cần xác nhận màn hình và luồng thực tế trên Product.'),
], [1.85, 1.55, 3.1])
heading(doc, 'Phụ lục B Phân quyền cần kiểm chứng thêm')
normal(doc, 'Tài liệu không suy diễn quyền của các vai trò chưa được cung cấp phiên đăng nhập. Cần bổ sung kiểm chứng cho Quản lý dự án, Kế toán/Thủ quỹ, Giám đốc/Admin trước khi ban hành bản hướng dẫn dành cho toàn công ty.')

# Footer page numbers
for section in doc.sections:
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_text(p, 'TITSMART  |  Hướng dẫn sử dụng', size=8.5, color='6B7280')

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(OUT.name)
