import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Button } from "../../components/ui/Button";
import {
  createClient,
  getClient,
  updateClient,
  type ClientInput,
} from "../../lib/db/clients";
import { isValidSiret } from "../../lib/validation/siretValidation";

interface FormData {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  siret: string;
  vatNumber: string;
  notes: string;
  isProfessional: string;
}

export function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      country: "France",
      isProfessional: "1",
    },
  });

  const isPro = watch("isProfessional");

  useEffect(() => {
    if (isEdit) {
      getClient(Number(id)).then((client) => {
        if (client) {
          reset({
            companyName: client.companyName ?? "",
            firstName: client.firstName ?? "",
            lastName: client.lastName ?? "",
            email: client.email ?? "",
            phone: client.phone ?? "",
            address: client.address,
            postalCode: client.postalCode,
            city: client.city,
            country: client.country,
            siret: client.siret ?? "",
            vatNumber: client.vatNumber ?? "",
            notes: client.notes ?? "",
            isProfessional: client.isProfessional ? "1" : "0",
          });
        }
      });
    }
  }, [id, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const input: ClientInput = {
      companyName: data.companyName || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
      siret: data.siret || null,
      vatNumber: data.vatNumber || null,
      notes: data.notes || null,
      isProfessional: data.isProfessional === "1",
    };

    if (isEdit) {
      await updateClient(Number(id), input);
    } else {
      await createClient(input);
    }
    navigate("/clients");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        {isEdit ? "Modifier le client" : "Nouveau client"}
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card title="Informations">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Type"
              options={[
                { value: "1", label: "Professionnel" },
                { value: "0", label: "Particulier" },
              ]}
              {...register("isProfessional")}
            />
            {isPro === "1" && (
              <Input
                label="Raison sociale"
                {...register("companyName")}
              />
            )}
            <Input label="Prenom" {...register("firstName")} />
            <Input label="Nom" {...register("lastName")} />
            <Input label="Email" type="email" {...register("email")} />
            <Input label="Telephone" {...register("phone")} />
          </div>
        </Card>

        <Card title="Adresse">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Adresse"
                {...register("address", { required: "Requis" })}
                error={errors.address?.message}
              />
            </div>
            <Input
              label="Code postal"
              {...register("postalCode", { required: "Requis" })}
              error={errors.postalCode?.message}
            />
            <Input
              label="Ville"
              {...register("city", { required: "Requis" })}
              error={errors.city?.message}
            />
            <Input label="Pays" {...register("country")} />
          </div>
        </Card>

        {isPro === "1" && (
          <Card title="Informations fiscales">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="SIRET"
                {...register("siret", {
                  validate: (v) =>
                    !v || isValidSiret(v) || "SIRET invalide",
                })}
                error={errors.siret?.message}
              />
              <Input
                label="N° TVA intracommunautaire"
                {...register("vatNumber")}
              />
            </div>
          </Card>
        )}

        <Card title="Notes">
          <textarea
            {...register("notes")}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            placeholder="Notes internes..."
          />
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/clients")}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : isEdit ? "Modifier" : "Creer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
