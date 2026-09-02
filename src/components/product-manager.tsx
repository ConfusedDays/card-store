"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, ImagePlus, LoaderCircle, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import type { AdminProduct } from "@/lib/product-admin";

type DraftVariant = {
  id?: string;
  label: string;
  durationLabel: string;
  priceYuan: string;
  active: boolean;
};

type DraftProduct = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  accent: string;
  imageUrl: string | null;
  active: boolean;
  sortOrder: string;
  variants: DraftVariant[];
};

const emptyVariant = (): DraftVariant => ({ label: "", durationLabel: "", priceYuan: "", active: true });
const emptyProduct = (): DraftProduct => ({
  slug: "",
  name: "",
  description: "",
  category: "数字授权",
  accent: "teal",
  imageUrl: null,
  active: true,
  sortOrder: "0",
  variants: [emptyVariant()],
});

function toDraft(product: AdminProduct): DraftProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    accent: product.accent,
    imageUrl: product.imageUrl,
    active: product.active,
    sortOrder: String(product.sortOrder),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      durationLabel: variant.durationLabel,
      priceYuan: (variant.priceCents / 100).toFixed(2),
      active: variant.active,
    })),
  };
}

export function ProductManager({ products, token, onSaved }: {
  products: AdminProduct[];
  token: string;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<DraftProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [orderedProductIds, setOrderedProductIds] = useState(() => products.map((product) => product.id));
  const [reordering, setReordering] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 220, tolerance: 7 } }));
  const orderedProducts = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    const ordered = orderedProductIds.flatMap((id) => byId.get(id) ?? []);
    const knownIds = new Set(orderedProductIds);
    return [...ordered, ...products.filter((product) => !knownIds.has(product.id))];
  }, [orderedProductIds, products]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reordering) return;
    const oldIndex = orderedProducts.findIndex((product) => product.id === active.id);
    const newIndex = orderedProducts.findIndex((product) => product.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = orderedProductIds;
    const next = arrayMove(orderedProducts, oldIndex, newIndex);
    const nextIds = next.map((product) => product.id);
    setOrderedProductIds(nextIds);
    setReordering(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ productIds: nextIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "保存商品排序失败");
      setOrderedProductIds(data.products.map((product: AdminProduct) => product.id));
      setMessage("商品展示顺序已保存");
      await onSaved();
    } catch (reason) {
      setOrderedProductIds(previous);
      setError(reason instanceof Error ? reason.message : "保存商品排序失败");
    } finally {
      setReordering(false);
    }
  }

  function editVariant(index: number, patch: Partial<DraftVariant>) {
    if (!draft) return;
    setDraft({ ...draft, variants: draft.variants.map((variant, itemIndex) => itemIndex === index ? { ...variant, ...patch } : variant) });
  }

  function removeVariant(index: number) {
    if (!draft) return;
    const variant = draft.variants[index];
    if (variant.id) {
      editVariant(index, { active: false });
      return;
    }
    setDraft({ ...draft, variants: draft.variants.filter((_, itemIndex) => itemIndex !== index) });
  }

  async function uploadProductImage(event: React.ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image) return;
    if (image.size > 5 * 1024 * 1024) {
      setError("宣传图不能超过 5MB");
      return;
    }

    setUploadingImage(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("image", image);
      const response = await fetch("/api/admin/product-images", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "上传宣传图失败");
      setDraft((current) => current ? { ...current, imageUrl: data.imageUrl } : current);
      setMessage("宣传图已上传，保存商品后生效");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "上传宣传图失败");
    } finally {
      setUploadingImage(false);
    }
  }
  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const variants = draft.variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        durationLabel: variant.durationLabel,
        priceCents: Math.round(Number(variant.priceYuan) * 100),
        active: variant.active,
      }));
      if (variants.some((variant) => !Number.isFinite(variant.priceCents) || variant.priceCents < 1)) throw new Error("请填写有效的规格价格");
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          slug: draft.slug.trim(),
          name: draft.name.trim(),
          description: draft.description.trim(),
          category: draft.category.trim(),
          accent: draft.accent,
          imageUrl: draft.imageUrl,
          active: draft.active,
          sortOrder: Number(draft.sortOrder) || 0,
          variants,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "保存商品失败");
      await onSaved();
      setMessage(draft.id ? "商品已更新" : "商品已创建，可以导入卡密库存");
      setDraft(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存商品失败");
    } finally {
      setSaving(false);
    }
  }
  function toggleNewProduct() {
    setDraft((current) => current && !current.id ? null : emptyProduct());
    setError("");
    setMessage("");
  }

  function toggleProductEditor(product: AdminProduct) {
    setDraft((current) => current?.id === product.id ? null : toDraft(product));
    setError("");
    setMessage("");
  }
  return (
    <section className="admin-section" id="products">
      <div className="section-heading">
        <div><span className="section-index">PRODUCTS</span><h2>商品管理</h2></div>
        <button
          className={`secondary-command ${draft && !draft.id ? "selected" : ""}`}
          type="button"
          aria-pressed={Boolean(draft && !draft.id)}
          onClick={toggleNewProduct}
        >          <Plus size={17} /> 新增商品
        </button>
      </div>
      {message && <p className="product-manager-message success-message" role="status">{message}</p>}
      {error && <p className="product-manager-message form-error" role="alert">{error}</p>}
      <div className="product-management-layout">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className={`table-shell product-table ${reordering ? "saving-order" : ""}`}>
            <SortableContext items={orderedProducts.map((product) => product.id)} strategy={verticalListSortingStrategy}>
              <table>
                <thead><tr><th><span className="sr-only">排序</span></th><th>商品</th><th>链接标识</th><th>规格</th><th>状态</th><th><span className="sr-only">操作</span></th></tr></thead>
                <tbody>
                  {orderedProducts.map((product) => <SortableProductRow key={product.id} product={product} selected={draft?.id === product.id} onEdit={() => toggleProductEditor(product)} />)}
                </tbody>
              </table>
            </SortableContext>
            <p className="drag-order-hint">按住左侧手柄约 0.2 秒，然后上下拖动排序</p>
          </div>
        </DndContext>

        {draft ? (
          <form key={draft.id ?? "new-product"} className="product-editor" onSubmit={saveProduct}>
            <div className="editor-heading">
              <div><span className="section-index">{draft.id ? "EDIT PRODUCT" : "NEW PRODUCT"}</span><h3>{draft.id ? "编辑商品" : "新增商品"}</h3></div>
              <button className="icon-action" type="button" onClick={() => setDraft(null)} title="关闭编辑"><X size={17} /></button>
            </div>
            <div className="editor-grid">
              <label>商品名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
              <label>链接标识<input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="potassium-license" required /></label>
              <label>商品分类<input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required /></label>
              <label>展示顺序<input type="number" min="0" max="9999" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} required /></label>
              <label className="editor-wide">商品介绍<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="支持换行；前台会按相同的段落换行展示" required /></label>
              <div className="editor-wide product-image-field">
                <span>商品宣传图</span>
                <div className="product-image-control">
                  <div className={`product-image-preview ${draft.imageUrl ? "has-image" : ""}`}>
                    {draft.imageUrl ? (
                      <Image src={draft.imageUrl} alt={`${draft.name || "商品"}宣传图预览`} fill sizes="320px" unoptimized />
                    ) : (
                      <ImagePlus size={25} />
                    )}
                  </div>
                  <div className="product-image-actions">
                    <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadProductImage} />
                    <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>
                      {uploadingImage ? <LoaderCircle className="spinning" size={16} /> : <Upload size={16} />}
                      {uploadingImage ? "正在上传" : draft.imageUrl ? "更换图片" : "上传图片"}
                    </button>
                    {draft.imageUrl && (
                      <button className="remove-image" type="button" onClick={() => setDraft({ ...draft, imageUrl: null })} disabled={uploadingImage}>
                        <Trash2 size={16} /> 移除
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <label>主题色<select value={draft.accent} onChange={(event) => setDraft({ ...draft, accent: event.target.value })}><option value="teal">青绿</option><option value="amber">琥珀</option><option value="blue">蓝色</option><option value="green">绿色</option></select></label>
              <label className="toggle-field"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span><Check size={14} /></span>上架销售</label>
            </div>

            <div className="variant-editor-heading"><strong>价格规格</strong><button type="button" onClick={() => setDraft({ ...draft, variants: [...draft.variants, emptyVariant()] })}><Plus size={15} /> 添加规格</button></div>
            <div className="variant-editor-list">
              {draft.variants.map((variant, index) => (
                <div className={`variant-editor-row ${variant.active ? "" : "inactive"}`} key={variant.id ?? `new-${index}`}>
                  <input aria-label="规格名称" value={variant.label} onChange={(event) => editVariant(index, { label: event.target.value })} placeholder="月卡" required />
                  <input aria-label="规格说明" value={variant.durationLabel} onChange={(event) => editVariant(index, { durationLabel: event.target.value })} placeholder="30 天" required />
                  <label className="price-input"><span>¥</span><input aria-label="价格" type="number" min="0.01" step="0.01" value={variant.priceYuan} onChange={(event) => editVariant(index, { priceYuan: event.target.value })} placeholder="89.90" required /></label>
                  <label className="mini-toggle" title={variant.active ? "停用规格" : "启用规格"}><input type="checkbox" checked={variant.active} onChange={(event) => editVariant(index, { active: event.target.checked })} /><span><Check size={12} /></span></label>
                  <button className="remove-variant" type="button" onClick={() => removeVariant(index)} title={variant.id ? "停用规格" : "删除规格"}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <button className="primary-button" disabled={saving || uploadingImage}><Save size={18} /> {saving ? "正在保存..." : "保存商品"}</button>
          </form>
        ) : (
          <button
            className="product-editor-empty"
            type="button"
            onClick={toggleNewProduct}
          >
            <Plus size={24} />
            <span>选择商品编辑，或新增一个商品</span>
          </button>
        )}
      </div>
    </section>
  );
}
function SortableProductRow({ product, selected, onEdit }: { product: AdminProduct; selected: boolean; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  return (
    <tr ref={setNodeRef} className={isDragging ? "dragging" : ""} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <td><button className="drag-handle" type="button" aria-label={`长按拖动 ${product.name}`} title="长按拖动排序" {...attributes} {...listeners}><GripVertical size={17} /></button></td>
      <td><div className="product-table-name">
        <span className={`product-table-thumb ${product.imageUrl ? "has-image" : ""}`}>
          {product.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="38px" unoptimized /> : <ImagePlus size={15} />}
        </span>
        <span><strong>{product.name}</strong><small>{product.category}</small></span>
      </div></td>
      <td><code>{product.slug}</code></td>
      <td>{product.variants.filter((variant) => variant.active).length}</td>
      <td><span className={`status-badge ${product.active ? "status-delivered" : ""}`}>{product.active ? "上架" : "下架"}</span></td>
      <td><button className={`table-action ${selected ? "selected" : ""}`} type="button" aria-pressed={selected} onClick={onEdit} title={selected ? `关闭 ${product.name} 编辑` : `编辑 ${product.name}`}><Pencil size={16} /></button></td>
    </tr>
  );
}
