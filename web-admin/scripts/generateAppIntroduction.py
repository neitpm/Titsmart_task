from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'GIOI_THIEU_UNG_DUNG_TITSMART.docx'
IMAGE_DIR = ROOT / 'docs' / 'images' / 'product-cloud' / 'verified'

NAVY = '002B6B'
BLUE = 'EAF2FF'
GRID = 'D9E2F0'
TEXT = '1F2937'
MUTED = '64748B'


def set_cell_style(cell, fill=None):
    tc_pr = cell._tc.get_or_add_tcPr()
    if fill:
        shd = OxmlElement('w:shd')
        shd.set(qn('w:fill'), fill)
        tc_pr.append(shd)
    borders = tc_pr.first_child_found_in('w:tcBorders')
    if borders is None:
        borders = OxmlElement('w:tcBorders')
        tc_pr.append(borders)
    for edge in ('top', 'left', 'bottom', 'right'):
        item = borders.find(qn(f'w:{edge}'))
        if item is None:
            item = OxmlElement(f'w:{edge}')
            borders.append(item)
        item.set(qn('w:val'), 'single')
        item.set(qn('w:sz'), '6')
        item.set(qn('w:color'), GRID)
    margins = tc_pr.first_child_found_in('w:tcMar')
    if margins is None:
        margins = OxmlElement('w:tcMar')
        tc_pr.append(margins)
    for side, value in [('top', '100'), ('start', '120'), ('bottom', '100'), ('end', '120')]:
        node = margins.find(qn(f'w:{side}'))
        if node is None:
            node = OxmlElement(f'w:{side}')
            margins.append(node)
        node.set(qn('w:w'), value)
        node.set(qn('w:type'), 'dxa')


def text(paragraph, value, size=10.5, bold=False, color=TEXT):
    run = paragraph.add_run(value)
    run.bold = bold
    run.font.name = 'Arial'
    run._element.rPr.rFonts.set(qn('w:ascii'), 'Arial')
    run._element.rPr.rFonts.set(qn('w:hAnsi'), 'Arial')
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    return run


def heading(doc, value, level=1):
    p = doc.add_paragraph(style=f'Heading {level}')
    p.paragraph_format.space_before = Pt(15 if level == 1 else 9)
    p.paragraph_format.space_after = Pt(6)
    text(p, value, size=16 if level == 1 else 12, bold=True, color='000000')
    return p


def body(doc, value):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(7)
    p.paragraph_format.line_spacing = 1.15
    text(p, value, size=10.5)
    return p


def bullet(doc, value):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_after = Pt(4)
    text(p, value, size=10.5)
    return p


def table(doc, headers, rows, widths=None):
    result = doc.add_table(rows=1, cols=len(headers))
    result.style = 'Table Grid'
    result.alignment = WD_TABLE_ALIGNMENT.CENTER
    header = result.rows[0]
    for i, value in enumerate(headers):
        cell = header.cells[i]
        set_cell_style(cell, NAVY)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        text(p, value, size=9, bold=True, color='FFFFFF')
        if widths:
            cell.width = Inches(widths[i])
    for row_index, values in enumerate(rows):
        cells = result.add_row().cells
        for i, value in enumerate(values):
            cell = cells[i]
            set_cell_style(cell, 'F7FAFC' if row_index % 2 else None)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            text(p, value, size=9.5)
            if widths:
                cell.width = Inches(widths[i])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return result


def figure(doc, filename, caption):
    image = IMAGE_DIR / filename
    if not image.exists():
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(3)
    p.add_run().add_picture(str(image), width=Inches(6.9))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(9)
    text(cap, caption, size=9, color=MUTED)


def page_break(doc):
    doc.add_page_break()


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.72)
section.bottom_margin = Inches(0.72)
section.left_margin = Inches(0.75)
section.right_margin = Inches(0.75)

styles = doc.styles
styles['Normal'].font.name = 'Arial'
styles['Normal']._element.rPr.rFonts.set(qn('w:ascii'), 'Arial')
styles['Normal']._element.rPr.rFonts.set(qn('w:hAnsi'), 'Arial')
styles['Normal'].font.size = Pt(10.5)

# Cover
p = doc.add_paragraph(style='Title')
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(100)
p.paragraph_format.space_after = Pt(18)
text(p, 'GIỚI THIỆU ỨNG DỤNG TITSMART', size=25, bold=True, color='000000')
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(18)
text(p, 'Nền tảng quản lý công việc và dự án', size=14, color=NAVY)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
text(p, 'Tài liệu phục vụ giới thiệu và báo cáo', size=10.5, color=MUTED)

page_break(doc)
heading(doc, 'Tổng quan ứng dụng')
body(doc, 'TITSMART là ứng dụng tập trung các hoạt động quản lý dự án, công việc, hồ sơ, vật tư, chấm công và nhân sự trên một nền tảng thống nhất. Mục tiêu là giúp người dùng theo dõi dữ liệu theo vai trò, giảm thao tác rời rạc và tăng khả năng phối hợp giữa văn phòng, dự án và hiện trường.')
heading(doc, 'Giá trị sử dụng', 2)
bullet(doc, 'Tập trung dữ liệu dự án, đầu việc và tiến độ vào một không gian làm việc chung.')
bullet(doc, 'Kết nối công việc với hồ sơ, kho, công và lương để hỗ trợ đối soát.')
bullet(doc, 'Cung cấp các màn hình tổng quan, tìm kiếm, lọc và tra cứu theo quyền của từng người dùng.')
bullet(doc, 'Hỗ trợ sử dụng trên nhiều nền tảng; dữ liệu và chức năng hiển thị theo tài khoản được cấp.')
figure(doc, '01-tong-quan.png', 'Trang Tổng quan trên Product Cloud')

page_break(doc)
heading(doc, 'Các nhóm chức năng chính')
table(doc, ['Nhóm chức năng', 'Vai trò trong vận hành'], [
    ('Dự án', 'Theo dõi danh sách dự án, trạng thái triển khai, mức ưu tiên, nhân sự liên quan và tiến độ.'),
    ('Công việc và kế hoạch', 'Tổ chức việc theo dự án, việc phát sinh, việc cá nhân và lịch kế hoạch.'),
    ('Quản lý hồ sơ', 'Tra cứu hồ sơ, hợp đồng và chứng từ theo dự án hoặc đối tác.'),
    ('Tổng kho', 'Theo dõi tồn kho, các lượt nhập kho và xuất kho.'),
    ('Công và lương', 'Theo dõi chấm công, nghỉ phép, bù công và các thông tin liên quan.'),
    ('Nhân sự', 'Tra cứu danh sách nhân sự và thông tin theo phạm vi quyền được cấp.'),
], [1.65, 4.85])
body(doc, 'Các thao tác tạo mới, chỉnh sửa, phê duyệt, thanh toán hoặc xóa dữ liệu chỉ xuất hiện khi tài khoản được cấp quyền phù hợp.')

page_break(doc)
heading(doc, 'Quản lý dự án')
body(doc, 'Khu vực Dự án hỗ trợ theo dõi danh sách theo ba phạm vi: Tất cả, Đang triển khai và Hoàn thành. Mỗi dự án hiển thị thông tin nhận diện, trạng thái, thành viên, địa điểm hoặc chủ đầu tư khi có dữ liệu, cùng mức độ hoàn thành.')
figure(doc, '02-du-an-tat-ca.png', 'Danh sách tất cả dự án')
figure(doc, '03-du-an-dang-trien-khai.png', 'Danh sách dự án đang triển khai')
figure(doc, '04-du-an-hoan-thanh.png', 'Danh sách dự án hoàn thành')

page_break(doc)
heading(doc, 'Công việc và kế hoạch')
body(doc, 'Công việc được phân tách để người dùng dễ theo dõi: công việc theo dự án, công việc phát sinh, việc của tôi và kế hoạch. Cách tổ chức này giúp xác định nguồn việc, người phụ trách, trạng thái và thời hạn thực hiện.')
figure(doc, '05-cong-viec-tong-quan.png', 'Tổng quan công việc')
figure(doc, '06-cong-viec-du-an.png', 'Công việc theo dự án')
figure(doc, '07-cong-viec-phat-sinh.png', 'Công việc phát sinh')
figure(doc, '08-viec-cua-toi.png', 'Việc của tôi')
figure(doc, '09-ke-hoach.png', 'Lịch và kế hoạch công việc')

page_break(doc)
heading(doc, 'Hồ sơ và kho')
body(doc, 'Quản lý hồ sơ là nơi tra cứu hồ sơ theo dự án, bên nhận hoặc bên gửi, hợp đồng, đối tác và trạng thái. Nhóm Tổng kho hỗ trợ theo dõi biến động vật tư thông qua các tab Tồn kho, Nhập kho và Xuất kho.')
figure(doc, '10-ho-so.png', 'Danh sách quản lý hồ sơ')
figure(doc, '11-kho-tong-quan.png', 'Tổng quan kho')
figure(doc, '12-kho-ton.png', 'Tồn kho')
figure(doc, '13-kho-nhap.png', 'Danh sách nhập kho')
figure(doc, '14-kho-xuat.png', 'Danh sách xuất kho')

page_break(doc)
heading(doc, 'Công và lương')
body(doc, 'Nhóm Công và lương tập hợp các dữ liệu liên quan đến chấm công, đơn xin nghỉ và bù công. Người dùng có thể theo dõi bản ghi, trạng thái đơn và số liệu tổng quan trong phạm vi quyền được cấp.')
figure(doc, '15-cong-luong-tong-quan.png', 'Tổng quan công và lương')
figure(doc, '16-cham-cong.png', 'Chấm công')
figure(doc, '17-xin-nghi.png', 'Quản lý đơn xin nghỉ')
figure(doc, '18-bu-cong.png', 'Chấm công bù')

page_break(doc)
heading(doc, 'Nhân sự và phân quyền')
body(doc, 'Khu vực Nhân sự cung cấp danh sách và thông tin liên quan đến người dùng. Giao diện và thao tác được điều chỉnh theo tài khoản, vì vậy cùng một chức năng có thể hiển thị khác nhau giữa nhân viên, quản lý dự án, kế toán/thủ quỹ và lãnh đạo.')
figure(doc, '19-nhan-su.png', 'Danh sách nhân sự')

page_break(doc)
heading(doc, 'Danh mục tab đã quan sát trên Product Cloud')
table(doc, ['Nhóm', 'Tab đã quan sát'], [
    ('Tổng quan', 'Tổng quan'),
    ('Dự án', 'Tất cả, Đang triển khai, Hoàn thành'),
    ('Công việc', 'Tổng quan, Dự án, Phát sinh, Việc của tôi, Kế hoạch'),
    ('Hồ sơ', 'Quản lý hồ sơ'),
    ('Tổng kho', 'Tổng quan, Tồn kho, Nhập kho, Xuất kho'),
    ('Công và lương', 'Tổng quan, Chấm công, Xin nghỉ, Bù công'),
    ('Nhân sự', 'Nhân sự'),
    ('Tài khoản', 'Khu vực cài đặt và tài khoản hiển thị theo từng tài khoản.'),
], [1.55, 4.95])
heading(doc, 'Lưu ý khi giới thiệu')
body(doc, 'Ảnh minh họa được chụp từ Product Cloud ở chế độ chỉ xem. Dữ liệu, nút thao tác và phạm vi phê duyệt thay đổi theo quyền của từng tài khoản và cấu hình thực tế của doanh nghiệp.')

for section in doc.sections:
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    text(p, 'TITSMART  |  Giới thiệu ứng dụng', size=8.5, color=MUTED)

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(OUT.name)
