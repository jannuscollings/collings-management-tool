from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "is_staff")
        read_only_fields = ("id", "is_staff")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ("id", "email", "password", "first_name", "last_name")

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class PeopleSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, min_length=8, required=False, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ("id", "first_name", "last_name", "display_name", "email", "job_title", "is_staff", "is_active", "is_superuser", "password")
        read_only_fields = ("id", "is_superuser", "display_name")

    def get_display_name(self, user):
        return user.get_full_name() or user.email

    def validate_email(self, value):
        value = value.strip().lower()
        users = User.objects.filter(email__iexact=value)
        if self.instance:
            users = users.exclude(pk=self.instance.pk)
        if users.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        if not self.instance:
            if not attrs.get("password"):
                raise serializers.ValidationError({"password": "Enter an initial password."})
            if "is_staff" not in attrs:
                raise serializers.ValidationError({"is_staff": "Choose a role."})
        elif "password" in attrs:
            raise serializers.ValidationError({"password": "Password changes are not available in People."})
        elif self.instance.pk == self.context["request"].user.pk:
            if attrs.get("is_staff") is False:
                raise serializers.ValidationError({"is_staff": "You cannot remove your own Admin access."})
            if attrs.get("is_active") is False:
                raise serializers.ValidationError({"is_active": "You cannot deactivate your own account."})
        if self.instance and self.instance.is_superuser:
            if attrs.get("is_staff") is False or attrs.get("is_active") is False:
                raise serializers.ValidationError({"is_staff": "A superuser's role and status are managed outside People."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)
