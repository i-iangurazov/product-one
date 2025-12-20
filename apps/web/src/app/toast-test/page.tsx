'use client'

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";
import { useTranslations } from "next-intl";

export default function ToastTestPage() {
  const t = useTranslations();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('toastTest.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => toastInfo(t('toastTest.messages.default'))}>{t('toastTest.buttons.default')}</Button>
          <Button onClick={() => toastSuccess(t('toastTest.messages.success'))} variant="secondary">
            {t('toastTest.buttons.success')}
          </Button>
          <Button onClick={() => toastError(t('toastTest.messages.error'))} variant="destructive">
            {t('toastTest.buttons.error')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
